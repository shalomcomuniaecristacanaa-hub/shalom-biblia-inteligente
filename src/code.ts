type Verse = { id: string; reference: string; text: string; group: string; background: string; theme: string; book?: string };
type UiMessage = { type: string; [key: string]: any };

const STORE_KEY = "shalom.verses.v1";
const GROUP_BACKGROUNDS_KEY = "shalom.group-backgrounds.v1";
const EVENT_SCHEDULES_KEY = "shalom.event-schedules.v1";
const CONNECTION_SETTINGS_KEY = "shalom.connection-settings.v1";
const LIGHTING_SCENES_KEY = "shalom.lighting-scenes.v1";
type GroupBackgrounds = { Ceia: string; Palavra: string; Dízimo: string };
const PLUGIN_TAG = "[Shalom Bíblia]";
const prepared = new Set<string>();
const previousBackgrounds = new Map<string, unknown>();
let bibleWatchTimer: ReturnType<typeof setInterval> | undefined;
let bibleWatchConfig = { output: "0", captureLayer: 0 };
let lastBibleSnapshot = "";
let scheduleWatchTimer: ReturnType<typeof setInterval> | undefined;
let scheduleWatchBusy = false;


async function callVmix(functionName: string, input?: string) {
  const settings = await spresenter.storage.get<any>(CONNECTION_SETTINGS_KEY) ?? {};
  const host = String(settings.vmixIp ?? "").trim();
  const port = Number(settings.vmixPort ?? 8088);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Porta da API vMix inválida.");
  if (!host) throw new Error("Informe e salve o IP do computador vMix em Configurações.");
  const params = new URLSearchParams();
  if (functionName) params.set("Function", functionName);
  if (input) params.set("Input", input);
  const query = params.toString();
  const response = await fetch(`http://${host}:${port}/api/${query ? "?" + query : ""}`, { method: "GET" });
  if (!response.ok) throw new Error(`vMix respondeu HTTP ${response.status}.`);
  const body = await response.text();
  if (!body.trim()) throw new Error("O vMix respondeu sem conteúdo.");
  return body;
}

async function runDueSchedules() {
  if (scheduleWatchBusy) return;
  scheduleWatchBusy = true;
  try {
    const schedules = await spresenter.storage.get<any[]>(EVENT_SCHEDULES_KEY) ?? [];
    const now = Date.now();
    let changed = false;
    for (const schedule of schedules) {
      if (!schedule?.enabled || schedule.executedAt || !schedule.date || !schedule.time) continue;
      const dueAt = new Date(schedule.date + "T" + schedule.time).getTime();
      if (!Number.isFinite(dueAt) || dueAt > now) continue;
      const results: Record<string, any> = schedule.stepResults ?? {};
      const runStep = async (key: string, action: () => Promise<unknown>) => {
        if (results[key]) return;
        const startedAt = new Date().toISOString();
        try {
          await action();
          results[key] = { status: "success", startedAt, finishedAt: new Date().toISOString(), error: "" };
        } catch (error) {
          results[key] = { status: "failed", startedAt, finishedAt: new Date().toISOString(), error: error instanceof Error ? error.message : String(error) };
        }
      };
      if (schedule.coverGuid) {
        await runStep("spresenterMedia", () => presentLibraryBackground({ type: "present-library-background", guid: schedule.coverGuid, output: schedule.output ?? "0", backgroundLayer: Number(schedule.backgroundLayer ?? 1) }));
      }
      if (schedule.youtubeUrl) {
        await runStep("youtube", async () => {
          let parsed: URL;
          try { parsed = new URL(String(schedule.youtubeUrl).trim()); } catch { throw new Error("URL do YouTube inválida."); }
          if (parsed.protocol !== "https:" || !/(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(parsed.hostname)) throw new Error("Informe um endereço HTTPS válido do YouTube.");
          spresenter.ui.postMessage({ type: "open-youtube-url", url: parsed.href });
        });
      }
      if (schedule.grandmaCommand) {
        await runStep("grandma2", async () => { throw new Error("O envio de comandos GrandMA2 ainda não está conectado ao agendador."); });
      }
      if (schedule.vmixFunction || schedule.startStream) {
        await runStep("vmix", async () => {
          if (schedule.vmixFunction) {
            const parts = String(schedule.vmixFunction).split(",").map((part: string) => part.trim());
            await callVmix(parts[0], parts[1]);
          }
          if (schedule.startStream) await callVmix("StartStreaming");
        });
      }
      schedule.stepResults = results;
      schedule.executedAt = new Date().toISOString();
      changed = true;
    }
    if (changed) {
      await spresenter.storage.set(EVENT_SCHEDULES_KEY, schedules);
      await sendState();
      spresenter.ui.postMessage({ type: "notice", message: "O agendador processou um ou mais eventos. Confira o resultado de cada etapa." });
    }
  } catch (error) {
    console.error(PLUGIN_TAG, "Falha no agendador:", error);
  } finally {
    scheduleWatchBusy = false;
  }
}
function startScheduleWatch() {
  if (scheduleWatchTimer) return;
  scheduleWatchTimer = setInterval(() => { void runDueSchedules(); }, 1000);
  void runDueSchedules();
}


function safeText(value: unknown): string {
  return String(value ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}
function collectText(value: unknown, out: string[] = [], depth = 0): string[] {
  if (depth > 10 || value == null) return out;
  if (typeof value === "string") {
    const s = value.trim();
    if (s && !/^https?:\/\//i.test(s)) out.push(s);
  } else if (Array.isArray(value)) {
    for (const item of value) collectText(item, out, depth + 1);
  } else if (typeof value === "object") {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (/url|uri|guid|id|color|font|path|thumbnail|src|css|asset/i.test(key)) continue;
      collectText(item, out, depth + 1);
    }
  }
  return out;
}
async function getVerses(): Promise<Verse[]> {
  return (await spresenter.storage.get<Verse[]>(STORE_KEY)) ?? [];
}
async function sendState() {
  const [verses, outputs, layers, groupBackgrounds, eventSchedules, connectionSettings, lightingScenes] = await Promise.all([
    getVerses(), spresenter.outputs.list(), spresenter.layers.list(),
    spresenter.storage.get<GroupBackgrounds>(GROUP_BACKGROUNDS_KEY),
    spresenter.storage.get<any[]>(EVENT_SCHEDULES_KEY),
    spresenter.storage.get<any>(CONNECTION_SETTINGS_KEY),
    spresenter.storage.get<any[]>(LIGHTING_SCENES_KEY)
  ]);
  spresenter.ui.postMessage({ type: "state", verses, outputs, layers, groupBackgrounds: groupBackgrounds ?? { Ceia: "", Palavra: "", "Dízimo": "" }, eventSchedules: eventSchedules ?? [], connectionSettings: connectionSettings ?? { grandmaIp: "", vmixIp: "" }, lightingScenes: lightingScenes ?? [] });
}
function stagePresentation(title: string, elementId: string) {
  return {
    title,
    asset: { type: "presentation", guid: `br-shalom-${elementId}`, title },
    theme: {
      title, css: {},
      elements: [{
        id: elementId, type: "RECTANGLE", x: 0, y: 0, visible: true,
        css: { position: "absolute", left: 0, top: 0, width: "100%", height: "100%" }
      }]
    },
    props: {}
  };
}
async function ensureStage(output: string, layer: number, kind: "content" | "background") {
  const key = `${output}:${layer}:${kind}`;
  if (prepared.has(key)) return;
  const element = kind === "content" ? "shalom-verse" : "shalom-background";
  await spresenter.live.apply(output, layer, stagePresentation(kind === "content" ? "Shalom - Versículo" : "Shalom - Fundo", element));
  await spresenter.live.setState(output, layer, { show: true, opacity: 1 });
  prepared.add(key);
}
function normalizeBackgroundSource(source: string): string {
  let value = String(source ?? "").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
  // Aceita links simples, com <...> ou copiados no formato Markdown.
  if (value.startsWith("[") && value.includes("](") && value.endsWith(")")) {
    const open = value.indexOf("](");
    value = value.slice(open + 2, -1).trim();
  }
  if (value.startsWith("<") && value.endsWith(">")) value = value.slice(1, -1).trim();
  return value;
}
async function resolveBackground(source: string): Promise<string> {
  const value = normalizeBackgroundSource(source);
  if (!value) return "";
  if (/^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(value)) return value;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Endereço inválido. Cole somente o link completo da imagem, começando com https://, ou selecione um arquivo do computador.");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("O endereço da imagem precisa começar com http:// ou https://.");
  }
  // A exibição em <img> não exige CORS como um download via fetch.
  return parsed.href;
}
function backgroundHtml(source: string, theme: string) {
  const safeSource = safeText(source);
  const image = safeSource
    ? `<img src="${safeSource}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;display:block;" />`
    : "";
  const fallback = "background:radial-gradient(ellipse at 50% 30%,#56647a 0%,#1c2939 48%,#090e18 100%);";
  return `<div style="position:absolute;inset:0;overflow:hidden;${fallback}">${image}<div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(5,8,14,.22),rgba(5,8,14,.38));pointer-events:none;"></div><div style="position:absolute;inset:0;background:linear-gradient(0deg,rgba(0,0,0,.18),transparent 55%);pointer-events:none;"></div></div>`;
}
function verseHtml(verse: Verse) {
  const ref = safeText(verse.reference);
  const text = safeText(verse.text);
  return `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:7vw 9vw;background:transparent;text-align:center;font-family:Georgia,'Times New Roman',serif;color:#fff;text-shadow:0 3px 18px rgba(0,0,0,.8);"><div style="max-width:90vw;"><div style="font-size:clamp(25px,4.1vw,68px);line-height:1.32;font-weight:600;">${text}</div><div style="margin-top:3vh;font:600 clamp(16px,1.8vw,28px) Arial,sans-serif;letter-spacing:.16em;color:#f1d49a;text-transform:uppercase;">${ref}</div></div></div>`;
}
async function present(msg: UiMessage) {
  const verse = msg.verse as Verse;
  if (!verse?.reference?.trim() || !verse?.text?.trim()) throw new Error("Versículo sem referência ou texto.");
  const output = String(msg.output ?? "0");
  const contentLayer = Number(msg.contentLayer);
  const backgroundLayer = Number(msg.backgroundLayer);
  if (!Number.isInteger(contentLayer) || !Number.isInteger(backgroundLayer) || contentLayer === backgroundLayer) {
    throw new Error("Selecione duas camadas diferentes: Conteúdo e Fundo.");
  }

  // Regra principal: ao apresentar um versículo, escrever somente na camada
  // Conteúdo. Não ler, preparar, aplicar, limpar nem substituir a camada Fundo.
  // Assim o fundo que o operador já deixou programado no SPresenter permanece
  // exatamente como está, inclusive quando existe imagem padrão cadastrada.
  await ensureStage(output, contentLayer, "content");
  spresenter.live.element(output, contentLayer, "shalom-verse").setHtml(verseHtml(verse));

  spresenter.ui.postMessage({
    type: "presented",
    reference: verse.reference,
    background: "preserved",
    message: "Versículo enviado somente para Conteúdo. Fundo principal programado preservado."
  });
}
async function captureLive(msg: UiMessage) {
  const output = String(msg.output ?? "0");
  const layer = Number(msg.captureLayer);
  const live = await spresenter.live.read(output);
  const presentation = live?.[layer];
  if (!presentation) throw new Error("Não há conteúdo ao vivo na camada escolhida. Coloque somente o versículo desejado ao vivo e tente novamente.");
  // Leia somente os dados preenchidos da apresentação. Percorrer o objeto inteiro
  // também captura tema, elementos-modelo e placeholders, gerando falsos "dois textos".
  const liveProps = (presentation as { props?: unknown }).props;
  const rawStrings = collectText(liveProps);
  if (!rawStrings.length) {
    throw new Error("Não encontrei o texto preenchido nos dados do versículo ao vivo. Confira a camada Conteúdo selecionada.");
  }
  const lines = rawStrings.flatMap(value => value.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n").replace(/\\r/g, "\n").split(/\r?\n/))
    .map(value => value.trim()).filter(Boolean);
  const isPlaceholder = (value: string) => /^\{\s*(?:verso|livro|cap[ií]tulo|vers[ií]culo|vers[aã]o)\s*\}$/i.test(value)
    || /^\{\s*livro\s*\}\s+\{\s*cap[ií]tulo\s*\}:\{\s*vers[ií]culo\s*\}$/i.test(value);
  const cleanLines = lines.map(value => value.replace(/^,?\s*TEXT\s*$/i, "").trim())
    .filter(value => value && !isPlaceholder(value) && !/^Padr[aã]o\s*[—-]\s*B[ií]blia$/i.test(value));
  const bookNames = ["Gênesis","Êxodo","Levítico","Números","Deuteronômio","Josué","Juízes","Rute","1 Samuel","2 Samuel","1 Reis","2 Reis","1 Crônicas","2 Crônicas","Esdras","Neemias","Ester","Jó","Salmos","Provérbios","Eclesiastes","Cânticos","Isaías","Jeremias","Lamentações","Ezequiel","Daniel","Oséias","Joel","Amós","Obadias","Jonas","Miquéias","Naum","Habacuque","Sofonias","Ageu","Zacarias","Malaquias","Mateus","Marcos","Lucas","João","Atos","Romanos","1 Coríntios","2 Coríntios","Gálatas","Efésios","Filipenses","Colossenses","1 Tessalonicenses","2 Tessalonicenses","1 Timóteo","2 Timóteo","Tito","Filemom","Hebreus","Tiago","1 Pedro","2 Pedro","1 João","2 João","3 João","Judas","Apocalipse"];
  const book = cleanLines.find(value => bookNames.some(name => value.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"))) ?? "";
  const versionPattern = /^(NVI|NVT|ARA|ARC|ACF|NAA|NTLH|KJV|BKJ|AS21|NBV|TB)$/i;
  const version = cleanLines.find(value => versionPattern.test(value)) ?? "";
  const numbers = cleanLines.filter(value => /^\d{1,3}$/.test(value));
  const chapter = numbers.length >= 2 ? numbers[numbers.length - 2] : "";
  const verseNumber = numbers.length >= 2 ? numbers[numbers.length - 1] : "";
  const reference = book && chapter && verseNumber ? `${book} ${chapter}:${verseNumber}` : "";
  const metadata = new Set([book, version, ...numbers]);
  const textCandidates = [...new Set(cleanLines.filter(value => !metadata.has(value) && !versionPattern.test(value) && !/^\d{1,3}$/.test(value)))];
  // No formato observado da Bíblia do SPresenter, o primeiro campo de texto
  // após os metadados é o versículo selecionado; campos seguintes podem ser
  // prévia/continuação da passagem e não devem ser concatenados.
  if (!textCandidates.length) {
    throw new Error("Não consegui localizar o texto bíblico nos dados da camada selecionada. Confira se o versículo está ao vivo na camada escolhida.");
  }
  if (!book) throw new Error("A camada ao vivo não contém uma referência bíblica identificável.");
  const text = textCandidates[0].slice(0, 3000);
  spresenter.ui.postMessage({ type: "captured", reference, book, version, text, raw: lines.join(" | ").slice(0, 3000) });
}

function startBibleWatch() {
  if (bibleWatchTimer) return;
  bibleWatchTimer = setInterval(async () => {
    try {
      const live = await spresenter.live.read(bibleWatchConfig.output);
      const presentation = live?.[bibleWatchConfig.captureLayer];
      const props = (presentation as { props?: unknown } | undefined)?.props;
      if (!props) { lastBibleSnapshot = ""; return; }
      const snapshot = JSON.stringify(props);
      if (!snapshot || snapshot === lastBibleSnapshot) return;
      lastBibleSnapshot = snapshot;
      await captureLive({ type: "capture-live", output: bibleWatchConfig.output, captureLayer: bibleWatchConfig.captureLayer });
    } catch {
      // A camada pode estar vazia ou conter outro tipo de conteúdo; aguarde a próxima leitura.
    }
  }, 1200);
}



async function listLibrary(msg: UiMessage) {
  const requested = String(msg.assetType ?? "all");
  const assets = await spresenter.assets.list(requested === "all" ? undefined : { type: requested });
  const allAssets: any[] = [...(assets ?? [])];

  // Inclui os itens visuais que já estão no setlist ativo. Dependendo da
  // versão/estrutura do setlist, os itens podem vir em schedules, assets,
  // items ou agrupados em subobjetos. Não inventa itens do catálogo remoto.
  try {
    const active = await spresenter.setlists.getActive();
    const root = (active as any)?.setlist ?? active;
    const seen = new Set<string>();
    const collect = (value: any, depth = 0): any[] => {
      if (!value || depth > 8) return [];
      if (Array.isArray(value)) return value.flatMap(item => collect(item, depth + 1));
      if (typeof value !== "object") return [];
      const guid = String(value.guid ?? value.assetGuid ?? "");
      const own = guid ? [{ ...value, guid }] : [];
      return [...own, ...Object.entries(value)
        .filter(([key]) => ["schedules", "assets", "items", "groups", "children", "entries"].includes(key))
        .flatMap(([, child]) => collect(child, depth + 1))];
    };
    for (const item of collect(root)) {
      const guid = String(item.guid ?? "");
      if (guid && !seen.has(guid) && !allAssets.some((existing: any) => existing.guid === guid)) {
        seen.add(guid);
        allAssets.push(item);
      }
    }
  } catch (error) {
    console.warn(PLUGIN_TAG, "Não foi possível ler os itens do setlist ativo:", error);
  }

  const isVisual = (asset: any) => {
    const type = String(asset?.type ?? "").toLowerCase();
    const guid = String(asset?.guid ?? "");
    return ["image", "video", "backgroundvideo", "motion", "motionbackground", "animatedbackground"].includes(type)
      || guid.startsWith("worshipwide/");
  };
  const mapped = await Promise.all(allAssets.map(async (asset: any) => {
    let thumbnail = asset.thumbnailUrl ?? asset.thumbnail ?? asset.artwork ?? "";
    if (!thumbnail && isVisual(asset) && asset.guid) {
      try {
        const type = String(asset.type ?? "").toLowerCase();
        thumbnail = await spresenter.thumbnails.render({
          title: asset.title ?? asset.name ?? "Fundo",
          asset: { guid: asset.guid, type: asset.guid.startsWith("worshipwide/") ? "backgroundVideo" : (type || "backgroundVideo") }
        }, 320, 180) ?? "";
      } catch { thumbnail = ""; }
    }
    return {
      guid: asset.guid, title: asset.title, name: asset.name,
      type: asset.guid?.startsWith("worshipwide/") ? "worshipwide" : asset.type,
      artist: asset.artist, author: asset.author,
      extension: asset.extension, thumbnail
    };
  }));
  const filtered = requested === "all" ? mapped : mapped.filter((asset: any) => String(asset.type ?? "") === requested);
  spresenter.ui.postMessage({ type: "library-found", assets: filtered });
}
async function presentLibraryBackground(msg: UiMessage) {
  const guid = String(msg.guid ?? "");
  const output = String(msg.output ?? "0");
  const layer = Number(msg.backgroundLayer);
  if (!guid || !Number.isInteger(layer)) throw new Error("Selecione uma mídia local e a camada Fundo.");

  const isWorshipwide = guid.startsWith("worshipwide/");
  const asset = isWorshipwide ? null : await spresenter.assets.get(guid);
  if (!asset && !isWorshipwide) throw new Error("Não encontrei essa mídia na biblioteca do SPresenter.");

  const originalType = String((asset as any)?.type ?? (isWorshipwide ? "backgroundVideo" : ""));
  const normalizedType = originalType.toLowerCase();
  const isImage = normalizedType === "image";
  const isVideo = ["video", "backgroundvideo"].includes(normalizedType) || isWorshipwide;
  if (!isWorshipwide && !isImage && !isVideo) {
    throw new Error("Esse tipo de mídia não pode ser usado como fundo. Escolha uma imagem ou vídeo.");
  }

  const title = String((asset as any)?.title ?? (asset as any)?.name ?? (isWorshipwide ? "Fundo Worshipwide" : "Mídia local"));

  // O endpoint interno de apresentação do SPresenter resolve temas e fundos
  // por saída, mas não existe método live.present no SDK público. Para imagens,
  // usamos o renderer de miniaturas do próprio SPresenter em resolução de saída
  // e o elemento HTML já suportado pelo plugin; assim não enviamos uma
  // apresentação image sem theme (que o renderer nativo deixa vazia).
  if (isImage) {
    const outputs = await spresenter.outputs.list();
    const outputInfo = outputs.find((item: any) => String(item.index) === output);
    const width = Math.max(1280, Number((outputInfo as any)?.width ?? 1920));
    const height = Math.max(720, Number((outputInfo as any)?.height ?? 1080));
    let imageSource = String(msg.thumbnail ?? (asset as any)?.thumbnailUrl ?? (asset as any)?.thumbnail ?? "");
    if (!imageSource) {
      try {
        imageSource = await spresenter.thumbnails.render({
          title,
          asset: { guid, type: "image" }
        }, width, height) ?? "";
      } catch (error) {
        console.warn(PLUGIN_TAG, "Falha ao gerar imagem para projeção:", error);
      }
    }
    if (!imageSource) {
      throw new Error("O SPresenter não forneceu uma imagem renderizada para projeção. A mídia aparece na biblioteca, mas não foi possível obter sua imagem em resolução de saída.");
    }
    await ensureStage(output, layer, "background");
    spresenter.live.element(output, layer, "shalom-background").setHtml(backgroundHtml(imageSource, "Fundo local"));
    await spresenter.live.setState(output, layer, { show: true, opacity: 1 });
  } else {
    const presentation = {
      title,
      asset: { guid, type: "backgroundVideo" },
      props: {}
    };
    await spresenter.live.apply(output, layer, presentation);
    await spresenter.live.setState(output, layer, { show: true, opacity: 1 });
  }

  spresenter.ui.postMessage({
    type: "background-presented", guid, title,
    message: "Fundo enviado à camada Fundo."
  });
}

async function searchSongs(msg: UiMessage) {
  const query = String(msg.query ?? "").trim();
  if (!query) throw new Error("Digite o nome de um louvor.");
  try {
    const songs = await spresenter.assets.search(query, { type: "music" });
    spresenter.ui.postMessage({ type: "songs-found", query, songs: (songs ?? []).map((song: any) => ({
      guid: song.guid, title: song.title, name: song.name, artist: song.artist, author: song.author
    })) });
  } catch (error) {
    // Uma falha na pesquisa local também permite que a interface tente a busca online.
    spresenter.ui.postMessage({ type: "songs-found", query, songs: [], localError: error instanceof Error ? error.message : String(error) });
  }
}
async function getSongSections(msg: UiMessage) {
  const guid = String(msg.guid ?? "");
  if (!guid) throw new Error("Louvor inválido.");
  const lyrics = await spresenter.assets.getLyrics(guid);
  const sections = (lyrics as any)?.sections ?? (lyrics as any)?.verses ?? [];
  spresenter.ui.postMessage({ type: "song-sections", guid, sections });
}
async function presentSong(msg: UiMessage) {
  const output = String(msg.output ?? "0");
  const layer = Number(msg.contentLayer);
  const guid = String(msg.guid ?? "");
  const index = Number(msg.index ?? 0);
  if (!guid || !Number.isInteger(layer) || !Number.isInteger(index)) throw new Error("Selecione um louvor e uma camada Conteúdo válidos.");
  await spresenter.live.setMusicVerse(output, layer, guid, index);
  await spresenter.live.setState(output, layer, { show: true, opacity: 1 });
  spresenter.ui.postMessage({ type: "presented", guid, index, message: "Parte do louvor enviada para o telão." });
}
async function presentMessage(msg: UiMessage) {
  const output = String(msg.output ?? "0");
  const layer = Number(msg.contentLayer);
  const text = String(msg.text ?? "").trim();
  if (!text) throw new Error("Digite uma mensagem antes de apresentar.");
  if (!Number.isInteger(layer)) throw new Error("Selecione a camada Conteúdo.");
  await ensureStage(output, layer, "content");
  const html = '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:8vw;background:transparent;color:#fff;text-align:center;font:600 clamp(28px,4vw,64px)/1.3 Arial,sans-serif;text-shadow:0 3px 18px #000;white-space:pre-wrap;">' + safeText(text) + '</div>';
  spresenter.live.element(output, layer, "shalom-verse").setHtml(html);
  await spresenter.live.setState(output, layer, { show: true, opacity: 1 });
  spresenter.ui.postMessage({ type: "presented", message: "Mensagem informativa apresentada." });
}
spresenter.ui.onmessage = async (raw: unknown) => {
  const msg = raw as UiMessage;
  if (!msg || typeof msg !== "object" || typeof msg.type !== "string") return;
  try {
    if (msg.type === "init") { await sendState(); startBibleWatch(); startScheduleWatch(); }
    else if (msg.type === "watch-bible") {
      bibleWatchConfig = { output: String(msg.output ?? "0"), captureLayer: Number(msg.captureLayer ?? 0) };
      lastBibleSnapshot = "";
      startBibleWatch();
    }

    else if (msg.type === "save-lighting-scene") {
      const scene = msg.scene;
      if (!scene?.id || !String(scene.name ?? "").trim() || !Array.isArray(scene.groups) || !scene.groups.length) throw new Error("Informe o nome da cena e configure pelo menos um grupo.");
      const scenes = await spresenter.storage.get<any[]>(LIGHTING_SCENES_KEY) ?? [];
      const index = scenes.findIndex((item: any) => item.id === scene.id);
      if (index >= 0) scenes[index] = scene; else scenes.unshift(scene);
      await spresenter.storage.set(LIGHTING_SCENES_KEY, scenes);
      await sendState();
      spresenter.ui.postMessage({ type: "notice", message: "Cena salva na biblioteca do Shalom. Ainda não foi enviada à GrandMA2." });
    } else if (msg.type === "delete-lighting-scene") {
      const scenes = await spresenter.storage.get<any[]>(LIGHTING_SCENES_KEY) ?? [];
      await spresenter.storage.set(LIGHTING_SCENES_KEY, scenes.filter((item: any) => item.id !== msg.id));
      await sendState();
      spresenter.ui.postMessage({ type: "notice", message: "Cena removida da biblioteca do Shalom." });
    }
    else if (msg.type === "save-event-schedule") {
      const schedule = msg.schedule;
      if (!schedule?.id || !schedule.name?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(schedule.date) || !/^\d{2}:\d{2}$/.test(schedule.time)) throw new Error("Informe nome, data e horário válidos para o evento.");
      const schedules = await spresenter.storage.get<any[]>(EVENT_SCHEDULES_KEY) ?? [];
      const index = schedules.findIndex((item: any) => item.id === schedule.id);
      if (index >= 0) schedules[index] = schedule; else schedules.push(schedule);
      await spresenter.storage.set(EVENT_SCHEDULES_KEY, schedules);
      await sendState();
      spresenter.ui.postMessage({ type: "notice", message: "Programação salva no Shalom." });
    } else if (msg.type === "vmix-start-stream") {
      await callVmix("StartStreaming");
      spresenter.ui.postMessage({ type: "vmix-action-result", message: "Comando para iniciar a transmissão enviado." });
    } else if (msg.type === "vmix-stop-stream") {
      await callVmix("StopStreaming");
      spresenter.ui.postMessage({ type: "vmix-action-result", message: "Comando para parar a transmissão enviado." });
    } else if (msg.type === "vmix-status") {
      const xml = await callVmix("");
      const streaming = /<streaming>True<\/streaming>/i.test(xml);
      spresenter.ui.postMessage({ type: "vmix-status-result", streaming, message: streaming ? "Transmissão ao vivo" : "Transmissão parada" });
    } else if (msg.type === "test-vmix-connection") {
      await callVmix("");
      spresenter.ui.postMessage({ type: "vmix-test-result", success: true, message: "Resposta recebida do vMix." });
    } else if (msg.type === "save-connection-settings") {
      const settings = msg.connectionSettings ?? {};
      const validateIp = (value: unknown, label: string) => {
        const ip = String(value ?? "").trim();
        if (!ip) return "";
        const parts = ip.split(".");
        if (parts.length !== 4 || parts.some(part => !/^\d{1,3}$/.test(part) || Number(part) > 255)) {
          throw new Error("Informe um IPv4 válido para " + label + " (ex.: 192.168.1.50).");
        }
        return ip;
      };
      const normalized = {
        grandmaIp: validateIp(settings.grandmaIp, "GrandMA2"),
        vmixIp: validateIp(settings.vmixIp, "vMix"),
        vmixPort: Number(settings.vmixPort ?? 8088)
      };
      if (!Number.isInteger(normalized.vmixPort) || normalized.vmixPort < 1 || normalized.vmixPort > 65535) throw new Error("Informe uma porta válida para a API do vMix (1–65535).");
      await spresenter.storage.set(CONNECTION_SETTINGS_KEY, normalized);
      await sendState();
      spresenter.ui.postMessage({ type: "notice", message: "Endereços de rede salvos." });
    } else if (msg.type === "delete-event-schedule") {
      const schedules = await spresenter.storage.get<any[]>(EVENT_SCHEDULES_KEY) ?? [];
      await spresenter.storage.set(EVENT_SCHEDULES_KEY, schedules.filter((item: any) => item.id !== msg.id));
      await sendState();
      spresenter.ui.postMessage({ type: "notice", message: "Programação excluída." });
    } else if (msg.type === "save-group-backgrounds") {
      const backgrounds = msg.groupBackgrounds as GroupBackgrounds;
      await spresenter.storage.set(GROUP_BACKGROUNDS_KEY, backgrounds);
      await sendState();
      spresenter.ui.postMessage({ type: "notice", message: "Imagens padrão de Ceia, Palavra e Dízimo salvas." });
    }
    else if (msg.type === "save-verse") {
      const verse = msg.verse as Verse;
      if (!verse?.id || !verse.reference?.trim() || !verse.text?.trim()) throw new Error("Preencha referência e texto.");
      const verses = await getVerses();
      const index = verses.findIndex(v => v.id === verse.id);
      if (index >= 0) verses[index] = verse; else verses.unshift(verse);
      await spresenter.storage.set(STORE_KEY, verses);
      await sendState();
    } else if (msg.type === "delete-verse") {
      await spresenter.storage.set(STORE_KEY, (await getVerses()).filter(v => v.id !== msg.id));
      await sendState();
    } else if (msg.type === "present-category-background") {
      const category = String(msg.category ?? "");
      if (!["Ceia", "Palavra", "Dízimo"].includes(category)) throw new Error("Selecione Ceia, Palavra ou Dízimo.");
      const defaults = await spresenter.storage.get<GroupBackgrounds>(GROUP_BACKGROUNDS_KEY);
      const source = defaults?.[category as keyof GroupBackgrounds] || (category !== "Palavra" ? defaults?.Palavra : "");
      if (!source) throw new Error(`Não há imagem padrão configurada para ${category} nem para Palavra. Configure em Configuração → Imagens padrão por categoria.`);
      const resolved = await resolveBackground(source);
      const output = String(msg.output ?? "0");
      const backgroundLayer = Number(msg.backgroundLayer);
      if (!Number.isInteger(backgroundLayer)) throw new Error("Selecione a camada Fundo nas configurações.");
      const key = `${output}:${backgroundLayer}`;
      if (!previousBackgrounds.has(key)) {
        const currentLive = await spresenter.live.read(output);
        const previous = currentLive?.[backgroundLayer];
        if (previous) previousBackgrounds.set(key, previous);
      }
      await ensureStage(output, backgroundLayer, "background");
      spresenter.live.element(output, backgroundLayer, "shalom-background").setHtml(backgroundHtml(resolved, category));
      spresenter.ui.postMessage({ type: "notice", message: `Fundo de ${category} enviado sem alterar o versículo.` });
    } else if (msg.type === "present") await present(msg);
    else if (msg.type === "list-library") await listLibrary(msg);
    else if (msg.type === "present-library-background") await presentLibraryBackground(msg);
    else if (msg.type === "search-songs") await searchSongs(msg);
    else if (msg.type === "get-song-sections") await getSongSections(msg);
    else if (msg.type === "present-song") await presentSong(msg);
    else if (msg.type === "present-message") await presentMessage(msg);
    else if (msg.type === "clear-content") await spresenter.live.clear(String(msg.output ?? "0"), Number(msg.contentLayer));
    else if (msg.type === "open-media") { await spresenter.panels.select("media"); spresenter.ui.postMessage({ type: "notice", message: "Painel de mídia aberto. A importação de PowerPoint não está exposta no SDK do plugin." }); }
    else if (msg.type === "capture-live") await captureLive(msg);
    else if (msg.type === "open-bible") {
      await spresenter.panels.select("bible");
      spresenter.ui.postMessage({ type: "notice", message: "Bíblia do SPresenter aberta. Selecione e coloque o versículo ao vivo; depois use Importar do Conteúdo." });
    } else if (msg.type === "restore-previous-background") {
      const output = String(msg.output ?? "0");
      const contentLayer = Number(msg.contentLayer);
      const backgroundLayer = Number(msg.backgroundLayer);
      const key = `${output}:${backgroundLayer}`;
      const previous = previousBackgrounds.get(key);
      if (!previous) {
        spresenter.ui.postMessage({ type: "notice", message: "Não há um fundo anterior salvo nesta sessão. Apresente primeiro um versículo sobre um fundo que já esteja ao vivo." });
      } else {
        await spresenter.live.clear(output, contentLayer);
        await spresenter.live.apply(output, backgroundLayer, previous);
        previousBackgrounds.delete(key);
        prepared.delete(`${output}:${contentLayer}:content`);
        prepared.delete(`${output}:${backgroundLayer}:background`);
        spresenter.ui.postMessage({ type: "notice", message: "Versículo encerrado. Fundo anterior restaurado." });
      }
    } else if (msg.type === "clear-background") {
      const output = String(msg.output ?? "0");
      const backgroundLayer = Number(msg.backgroundLayer);
      if (!Number.isInteger(backgroundLayer)) throw new Error("Selecione a camada Fundo.");
      await spresenter.live.clear(output, backgroundLayer);
      prepared.delete(`${output}:${backgroundLayer}:background`);
      spresenter.ui.postMessage({ type: "notice", message: "Fundo removido do telão." });
    } else if (msg.type === "clear") {
      const output = String(msg.output ?? "0");
      await spresenter.live.clear(output, Number(msg.contentLayer));
      await spresenter.live.clear(output, Number(msg.backgroundLayer));
      prepared.clear();
      spresenter.ui.postMessage({ type: "notice", message: "Camadas Conteúdo e Fundo limpas." });
    }
  } catch (error) {
    spresenter.ui.postMessage({ type: "error", message: error instanceof Error ? error.message : String(error) });
    console.error(PLUGIN_TAG, error);
  }
};

console.info(PLUGIN_TAG, "Painel pronto.");
