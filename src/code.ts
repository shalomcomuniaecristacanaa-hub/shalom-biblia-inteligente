import "@spresenter/plugin-sdk/code";

type Verse = { id: string; reference: string; text: string; group: string; background: string; theme: string };
type UiMessage = { type: string; [key: string]: any };

const STORE_KEY = "shalom.verses.v1";
const PLUGIN_TAG = "[Shalom Bíblia]";
const prepared = new Set<string>();

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
  const [verses, outputs, layers] = await Promise.all([
    getVerses(), spresenter.outputs.list(), spresenter.layers.list()
  ]);
  spresenter.ui.postMessage({ type: "state", verses, outputs, layers });
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
function backgroundHtml(url: string, theme: string) {
  const safeUrl = /^https?:\/\//i.test(url) ? url.replace(/["\\]/g, "") : "";
  const bg = safeUrl
    ? `background-image:linear-gradient(90deg,rgba(5,8,14,.30),rgba(5,8,14,.48)),url("${safeUrl}");background-size:cover;background-position:center;`
    : "background:radial-gradient(ellipse at 50% 30%,#56647a 0%,#1c2939 48%,#090e18 100%);";
  return `<div style="position:absolute;inset:0;overflow:hidden;${bg}"><div style="position:absolute;inset:0;background:linear-gradient(0deg,rgba(0,0,0,.18),transparent 55%);"></div></div>`;
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
  await ensureStage(output, backgroundLayer, "background");
  await ensureStage(output, contentLayer, "content");
  spresenter.live.element(output, backgroundLayer, "shalom-background").setHtml(backgroundHtml(verse.background ?? "", verse.theme ?? ""));
  spresenter.live.element(output, contentLayer, "shalom-verse").setHtml(verseHtml(verse));
  spresenter.ui.postMessage({ type: "presented", reference: verse.reference });
}
async function captureLive(msg: UiMessage) {
  const output = String(msg.output ?? "0");
  const layer = Number(msg.captureLayer);
  const live = await spresenter.live.read(output);
  const presentation = live?.[layer];
  const strings = [...new Set(collectText(presentation))];
  const joined = strings.join(" ").replace(/\s+/g, " ").trim();
  const referenceMatch = joined.match(/(?:Gênesis|Êxodo|Levítico|Números|Deuteronômio|Josué|Juízes|Rute|Samuel|Reis|Crônicas|Esdras|Neemias|Ester|Jó|Salmos?|Provérbios|Eclesiastes|Cânticos|Isaías|Jeremias|Lamentações|Ezequiel|Daniel|Mateus|Marcos|Lucas|João|Atos|Romanos|Coríntios|Gálatas|Efésios|Filipenses|Colossenses|Tessalonicenses|Timóteo|Tito|Filemom|Hebreus|Tiago|Pedro|Judas|Apocalipse)\s+\d{1,3}(?::\d{1,3}(?:[-–]\d{1,3})?)?/i);
  const reference = referenceMatch?.[0] ?? "";
  const text = strings.filter(s => s !== reference && s.length > 10).join("\n").slice(0, 3000);
  spresenter.ui.postMessage({ type: "captured", reference, text, raw: joined.slice(0, 3000) });
}

spresenter.ui.onmessage = async (raw: unknown) => {
  const msg = raw as UiMessage;
  if (!msg || typeof msg !== "object" || typeof msg.type !== "string") return;
  try {
    if (msg.type === "init") await sendState();
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
    } else if (msg.type === "present") await present(msg);
    else if (msg.type === "capture-live") await captureLive(msg);
    else if (msg.type === "open-bible") {
      await spresenter.panels.select("bible");
      spresenter.ui.postMessage({ type: "notice", message: "Bíblia do SPresenter aberta. Selecione e coloque o versículo ao vivo; depois use Importar do Conteúdo." });
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
