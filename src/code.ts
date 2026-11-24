type Verse = { id: string; reference: string; text: string; group: string; background: string; theme: string; book?: string };
type UiMessage = { type: string; [key: string]: any };

const STORE_KEY = "shalom.verses.v1";
const GROUP_BACKGROUNDS_KEY = "shalom.group-backgrounds.v1";
type GroupBackgrounds = { Ceia: string; Palavra: string; Dízimo: string };
const PLUGIN_TAG = "[Shalom Bíblia]";
const prepared = new Set<string>();
const previousBackgrounds = new Map<string, unknown>();
let bibleWatchTimer: ReturnType<typeof setInterval> | undefined;
let bibleWatchConfig = { output: "0", captureLayer: 0 };
let lastBibleSnapshot = "";

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
  const [verses, outputs, layers, groupBackgrounds] = await Promise.all([
    getVerses(), spresenter.outputs.list(), spresenter.layers.list(),
    spresenter.storage.get<GroupBackgrounds>(GROUP_BACKGROUNDS_KEY)
  ]);
  spresenter.ui.postMessage({ type: "state", verses, outputs, layers, groupBackgrounds: groupBackgrounds ?? { Ceia: "", Palavra: "", "Dízimo": "" } });
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



const bibleBooks: Array<[string, string, string[]]> = [
  ["Gênesis","gn",["genesis","gen"]],["Êxodo","ex",["exodo","exodus"]],["Levítico","lv",["levitico","lev"]],["Números","nm",["numeros","num"]],["Deuteronômio","dt",["deuteronomio","deut"]],
  ["Josué","js",["josue","joshua"]],["Juízes","jz",["juizes","juizes"]],["Rute","rt",["rute","ruth"]],["1 Samuel","1sm",["1samuel","i samuel"]],["2 Samuel","2sm",["2samuel","ii samuel"]],
  ["1 Reis","1rs",["1reis","i reis"]],["2 Reis","2rs",["2reis","ii reis"]],["1 Crônicas","1cr",["1cronicas","i cronicas"]],["2 Crônicas","2cr",["2cronicas","ii cronicas"]],["Esdras","ed",["esdras","ezra"]],
  ["Neemias","ne",["neemias","nehemias"]],["Ester","et",["ester","esther"]],["Jó","job",["jo","jó","job"]],["Salmos","sl",["salmo","salmos","psalms"]],["Provérbios","pv",["proverbios","prov"]],
  ["Eclesiastes","ec",["eclesiastes","ecclesiastes"]],["Cânticos","ct",["canticos","cantares","song of songs"]],["Isaías","is",["isaias","isaiah"]],["Jeremias","jr",["jeremias","jer"]],["Lamentações","lm",["lamentacoes","lamentations"]],
  ["Ezequiel","ez",["ezequiel","ezekiel"]],["Daniel","dn",["daniel","dan"]],["Oséias","os",["oseias","osea"]],["Joel","jl",["joel"]],["Amós","am",["amos"]],
  ["Obadias","ob",["obadias","obadiah"]],["Jonas","jn",["jonas","jonah"]],["Miquéias","mq",["miqueias","micah"]],["Naum","na",["naum","nahum"]],["Habacuque","hc",["habacuque","habakkuk"]],
  ["Sofonias","sf",["sofonias","zephaniah"]],["Ageu","ag",["ageu","haggai"]],["Zacarias","zc",["zacarias","zechariah"]],["Malaquias","ml",["malaquias","malachi"]],
  ["Mateus","mt",["mateus","matthew"]],["Marcos","mc",["marcos","mark"]],["Lucas","lc",["lucas","luke"]],["João","jo",["joao","john"]],["Atos","at",["atos","acts"]],
  ["Romanos","rm",["romanos","romans"]],["1 Coríntios","1co",["1corintios","i corintios"]],["2 Coríntios","2co",["2corintios","ii corintios"]],["Gálatas","gl",["galatas","galatians"]],
  ["Efésios","ef",["efesios","ephesians"]],["Filipenses","fp",["filipenses","philippians"]],["Colossenses","cl",["colossenses","colossians"]],
  ["1 Tessalonicenses","1ts",["1tessalonicenses","i tessalonicenses"]],["2 Tessalonicenses","2ts",["2tessalonicenses","ii tessalonicenses"]],
  ["1 Timóteo","1tm",["1timoteo","i timoteo"]],["2 Timóteo","2tm",["2timoteo","ii timoteo"]],["Tito","tt",["tito"]],["Filemom","fm",["filemom","philemon"]],
  ["Hebreus","hb",["hebreus","hebrews"]],["Tiago","tg",["tiago","james"]],["1 Pedro","1pe",["1pedro","i pedro"]],["2 Pedro","2pe",["2pedro","ii pedro"]],
  ["1 João","1jo",["1joao","i joao"]],["2 João","2jo",["2joao","ii joao"]],["3 João","3jo",["3joao","iii joao"]],["Judas","jd",["judas","jude"]],["Apocalipse","ap",["apocalipse","revelation"]]
];
function normalizeBibleName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]/g,"");
}
async function lookupBible(msg: UiMessage) {
  const raw = String(msg.reference ?? "").trim();
  const match = raw.match(/^(.+?)\s+(\d{1,3})(?:\s*:\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?)?$/);
  if (!match) throw new Error("Use o formato Livro capítulo:versículo, por exemplo João 3:16 ou João 3:16-17.");
  const enteredBook = normalizeBibleName(match[1]);
  const found = bibleBooks.find(([name, , aliases]) => [name, ...aliases].some(alias => normalizeBibleName(alias) === enteredBook));
  if (!found) throw new Error("Não reconheci esse livro. Confira o nome e tente novamente.");
  const chapter = Number(match[2]);
  const firstVerse = match[3] ? Number(match[3]) : 1;
  const lastVerse = match[4] ? Number(match[4]) : firstVerse;
  if (chapter < 1 || firstVerse < 1 || lastVerse < firstVerse || lastVerse - firstVerse > 5) throw new Error("Informe um capítulo e até seis versículos por consulta.");
  const version = String(msg.version ?? "nvi").toLowerCase();
  const url = `https://abibliadigital.api.br/api/verses/${encodeURIComponent(version)}/${encodeURIComponent(found[1])}/${chapter}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("O serviço bíblico não respondeu agora. Tente novamente em instantes.");
  const payload: any = await response.json();
  const rows: any[] = Array.isArray(payload) ? payload : (payload.verses ?? payload.data?.verses ?? []);
  const selected = rows.filter((item: any) => Number(item.number ?? item.verse) >= firstVerse && Number(item.number ?? item.verse) <= lastVerse);
  if (!selected.length || selected.length !== lastVerse - firstVerse + 1) throw new Error("Não encontrei todos os versículos dessa referência. Confira capítulo e numeração.");
  const text = selected.map((item: any) => `${item.number ?? item.verse}. ${String(item.text ?? "").replace(/<[^>]*>/g," ").replace(/&nbsp;/g," ").trim()}`).join("\\n");
  if (!text.trim()) throw new Error("A consulta retornou sem texto bíblico.");
  const reference = `${found[0]} ${chapter}:${firstVerse}${lastVerse > firstVerse ? "-" + lastVerse : ""}`;
  spresenter.ui.postMessage({ type: "bible-found", result: { reference, book: found[0], text } });
}

async function listLibrary(msg: UiMessage) {
  const requested = String(msg.assetType ?? "all");
  const assets = await spresenter.assets.list(requested === "all" ? undefined : { type: requested });
  spresenter.ui.postMessage({
    type: "library-found",
    assets: (assets ?? []).map((asset: any) => ({
      guid: asset.guid, title: asset.title, name: asset.name,
      type: asset.type, artist: asset.artist, author: asset.author
    }))
  });
}

async function searchSongs(msg: UiMessage) {
  const query = String(msg.query ?? "").trim();
  if (!query) throw new Error("Digite o nome de um louvor.");
  const songs = await spresenter.assets.search(query, { type: "music" });
  spresenter.ui.postMessage({ type: "songs-found", songs: (songs ?? []).map((song: any) => ({
    guid: song.guid, title: song.title, name: song.name, artist: song.artist, author: song.author
  })) });
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
  spresenter.ui.postMessage({ type: "presented", message: "Louvor enviado para o telão." });
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
    if (msg.type === "init") { await sendState(); startBibleWatch(); }
    else if (msg.type === "watch-bible") {
      bibleWatchConfig = { output: String(msg.output ?? "0"), captureLayer: Number(msg.captureLayer ?? 0) };
      lastBibleSnapshot = "";
      startBibleWatch();
    }
    else if (msg.type === "save-group-backgrounds") {
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
    else if (msg.type === "lookup-bible") {
      try { await lookupBible(msg); } catch (error) { spresenter.ui.postMessage({ type: "bible-error", message: error instanceof Error ? error.message : "Falha ao consultar a Bíblia." }); }
    }
    else if (msg.type === "list-library") await listLibrary(msg);
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
