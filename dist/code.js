(function() {
  "use strict";
  const STORE_KEY = "shalom.verses.v1";
  const PLUGIN_TAG = "[Shalom Bíblia]";
  const prepared = /* @__PURE__ */ new Set();
  function safeText(value) {
    return String(value ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  }
  function collectText(value, out = [], depth = 0) {
    if (depth > 10 || value == null) return out;
    if (typeof value === "string") {
      const s = value.trim();
      if (s && !/^https?:\/\//i.test(s)) out.push(s);
    } else if (Array.isArray(value)) {
      for (const item of value) collectText(item, out, depth + 1);
    } else if (typeof value === "object") {
      for (const [key, item] of Object.entries(value)) {
        if (/url|uri|guid|id|color|font|path|thumbnail|src|css|asset/i.test(key)) continue;
        collectText(item, out, depth + 1);
      }
    }
    return out;
  }
  async function getVerses() {
    return await spresenter.storage.get(STORE_KEY) ?? [];
  }
  async function sendState() {
    const [verses, outputs, layers] = await Promise.all([
      getVerses(),
      spresenter.outputs.list(),
      spresenter.layers.list()
    ]);
    spresenter.ui.postMessage({ type: "state", verses, outputs, layers });
  }
  function stagePresentation(title, elementId) {
    return {
      title,
      asset: { type: "presentation", guid: `br-shalom-${elementId}`, title },
      theme: {
        title,
        css: {},
        elements: [{
          id: elementId,
          type: "RECTANGLE",
          x: 0,
          y: 0,
          visible: true,
          css: { position: "absolute", left: 0, top: 0, width: "100%", height: "100%" }
        }]
      },
      props: {}
    };
  }
  async function ensureStage(output, layer, kind) {
    const key = `${output}:${layer}:${kind}`;
    if (prepared.has(key)) return;
    const element = kind === "content" ? "shalom-verse" : "shalom-background";
    await spresenter.live.apply(output, layer, stagePresentation(kind === "content" ? "Shalom - Versículo" : "Shalom - Fundo", element));
    await spresenter.live.setState(output, layer, { show: true, opacity: 1 });
    prepared.add(key);
  }
  function normalizeBackgroundSource(source) {
    let value = String(source ?? "").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
    if (value.startsWith("[") && value.includes("](") && value.endsWith(")")) {
      const open = value.indexOf("](");
      value = value.slice(open + 2, -1).trim();
    }
    if (value.startsWith("<") && value.endsWith(">")) value = value.slice(1, -1).trim();
    return value;
  }
  async function resolveBackground(source) {
    const value = normalizeBackgroundSource(source);
    if (!value) return "";
    if (/^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(value)) return value;
    let parsed;
    try {
      parsed = new URL(value);
    } catch {
      throw new Error("Endereço inválido. Cole somente o link completo da imagem, começando com https://, ou selecione um arquivo do computador.");
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error("O endereço da imagem precisa começar com http:// ou https://.");
    }
    return parsed.href;
  }
  function backgroundHtml(source, theme) {
    const safeSource = safeText(source);
    const image = safeSource ? `<img src="${safeSource}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;display:block;" />` : "";
    const fallback = "background:radial-gradient(ellipse at 50% 30%,#56647a 0%,#1c2939 48%,#090e18 100%);";
    return `<div style="position:absolute;inset:0;overflow:hidden;${fallback}">${image}<div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(5,8,14,.22),rgba(5,8,14,.38));pointer-events:none;"></div><div style="position:absolute;inset:0;background:linear-gradient(0deg,rgba(0,0,0,.18),transparent 55%);pointer-events:none;"></div></div>`;
  }
  function verseHtml(verse) {
    const ref = safeText(verse.reference);
    const text = safeText(verse.text);
    return `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:7vw 9vw;background:transparent;text-align:center;font-family:Georgia,'Times New Roman',serif;color:#fff;text-shadow:0 3px 18px rgba(0,0,0,.8);"><div style="max-width:90vw;"><div style="font-size:clamp(25px,4.1vw,68px);line-height:1.32;font-weight:600;">${text}</div><div style="margin-top:3vh;font:600 clamp(16px,1.8vw,28px) Arial,sans-serif;letter-spacing:.16em;color:#f1d49a;text-transform:uppercase;">${ref}</div></div></div>`;
  }
  async function present(msg) {
    const verse = msg.verse;
    if (!verse?.reference?.trim() || !verse?.text?.trim()) throw new Error("Versículo sem referência ou texto.");
    const output = String(msg.output ?? "0");
    const contentLayer = Number(msg.contentLayer);
    const backgroundLayer = Number(msg.backgroundLayer);
    if (!Number.isInteger(contentLayer) || !Number.isInteger(backgroundLayer) || contentLayer === backgroundLayer) {
      throw new Error("Selecione duas camadas diferentes: Conteúdo e Fundo.");
    }
    const resolvedBackground = await resolveBackground(verse.background ?? "");
    await ensureStage(output, backgroundLayer, "background");
    await ensureStage(output, contentLayer, "content");
    spresenter.live.element(output, backgroundLayer, "shalom-background").setHtml(backgroundHtml(resolvedBackground, verse.theme ?? ""));
    spresenter.live.element(output, contentLayer, "shalom-verse").setHtml(verseHtml(verse));
    spresenter.ui.postMessage({ type: "presented", reference: verse.reference });
  }
  async function captureLive(msg) {
    const output = String(msg.output ?? "0");
    const layer = Number(msg.captureLayer);
    const live = await spresenter.live.read(output);
    const presentation = live?.[layer];
    const ignored = /^(?:Padrão\s*[—-]\s*Bíblia|\{livro\}\s+\{capitulo\}:\{versiculo\})$/i;
    const strings = [...new Set(collectText(presentation))].map((s) => s.replace(/Padrão\s*[—-]\s*Bíblia/gi, "").replace(/\{livro\}\s*\{capitulo\}:\{versiculo\}/gi, "").trim()).filter((s) => s && !ignored.test(s) && !/^\{(?:livro|capitulo|versiculo)\}/i.test(s));
    const joined = strings.join(" ").replace(/\s+/g, " ").trim();
    const bookPattern = "(?:Gênesis|Êxodo|Levítico|Números|Deuteronômio|Josué|Juízes|Rute|1\\s*Samuel|2\\s*Samuel|1\\s*Reis|2\\s*Reis|1\\s*Crônicas|2\\s*Crônicas|Esdras|Neemias|Ester|Jó|Salmos?|Provérbios|Eclesiastes|Cânticos|Isaías|Jeremias|Lamentações|Ezequiel|Daniel|Oséias|Joel|Amós|Obadias|Jonas|Miquéias|Naum|Habacuque|Sofonias|Ageu|Zacarias|Malaquias|Mateus|Marcos|Lucas|João|Atos|Romanos|1\\s*Coríntios|2\\s*Coríntios|Gálatas|Efésios|Filipenses|Colossenses|1\\s*Tessalonicenses|2\\s*Tessalonicenses|1\\s*Timóteo|2\\s*Timóteo|Tito|Filemom|Hebreus|Tiago|1\\s*Pedro|2\\s*Pedro|1\\s*João|2\\s*João|3\\s*João|Judas|Apocalipse)";
    const referenceMatch = joined.match(new RegExp("(" + bookPattern + ")\\s+\\d{1,3}(?::\\d{1,3}(?:[-–]\\d{1,3})?)?", "i"));
    const reference = referenceMatch?.[0] ?? "";
    const book = referenceMatch?.[1] ?? "";
    const text = strings.filter((s) => s !== reference && s.length > 10 && !/Padrão\s*[—-]\s*Bíblia|\{livro\}|\{capitulo\}|\{versiculo\}/i.test(s)).join("\n").slice(0, 3e3);
    spresenter.ui.postMessage({ type: "captured", reference, book, text, raw: joined.slice(0, 3e3) });
  }
  spresenter.ui.onmessage = async (raw) => {
    const msg = raw;
    if (!msg || typeof msg !== "object" || typeof msg.type !== "string") return;
    try {
      if (msg.type === "init") await sendState();
      else if (msg.type === "save-verse") {
        const verse = msg.verse;
        if (!verse?.id || !verse.reference?.trim() || !verse.text?.trim()) throw new Error("Preencha referência e texto.");
        const verses = await getVerses();
        const index = verses.findIndex((v) => v.id === verse.id);
        if (index >= 0) verses[index] = verse;
        else verses.unshift(verse);
        await spresenter.storage.set(STORE_KEY, verses);
        await sendState();
      } else if (msg.type === "delete-verse") {
        await spresenter.storage.set(STORE_KEY, (await getVerses()).filter((v) => v.id !== msg.id));
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
})();
