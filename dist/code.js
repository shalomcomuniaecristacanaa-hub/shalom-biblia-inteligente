var ShalomBibliaInteligente = function(exports) {
  "use strict";
  const rules = [
    ["amor", ["amor", "amou", "amado", "caridade"], "ternura e esperança", "biblical divine love golden light cross cinematic"],
    ["fé", ["fé", "crer", "creia", "confiança"], "confiança", "faith sunrise mountain prayer cinematic"],
    ["esperança", ["esperança", "esperar", "renovo", "renovará"], "esperança", "hope sunrise clouds mountains cinematic"],
    ["proteção", ["refúgio", "escudo", "proteger", "protecao", "fortaleza"], "segurança", "peaceful shelter mountains storm cinematic"],
    ["força", ["força", "fortalece", "fortalecido", "vigor"], "coragem", "strength eagle flying over mountains cinematic"],
    ["oração", ["orar", "oração", "clamar", "súplica"], "reverência", "person praying soft heavenly light cinematic"],
    ["salvação", ["salvação", "salvar", "vida eterna", "redenção"], "reverência", "cross sunrise empty tomb cinematic"],
    ["paz", ["paz", "descanso", "tranquilo", "serenidade"], "calma", "serene lake sunrise nature cinematic"],
    ["adoração", ["louvor", "adorai", "adoração", "glória"], "adoração", "worship hands raised light beams cinematic"],
    ["sabedoria", ["sabedoria", "entendimento", "conhecimento"], "contemplação", "open bible warm light cinematic"]
  ];
  function classifyTheme(text) {
    const normalized = text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
    const found = rules.find(([, words]) => words.some(
      (w) => normalized.includes(w.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase())
    ));
    const [theme, mood, query] = found ? [found[0], found[2], found[3]] : ["bíblia", "contemplação", "biblical landscape dramatic cinematic background"];
    return { theme, mood, query, media: "photo" };
  }
  const API = "https://api.pexels.com";
  function authHeaders(apiKey) {
    if (!apiKey?.trim()) throw new Error("Configure a chave da API Pexels.");
    return { Authorization: apiKey };
  }
  async function searchPhotos(query, apiKey) {
    const url = new URL(`${API}/v1/search`);
    url.searchParams.set("query", query);
    url.searchParams.set("orientation", "landscape");
    url.searchParams.set("per_page", "12");
    const response = await fetch(url, { headers: authHeaders(apiKey) });
    if (!response.ok) throw new Error(`Pexels fotos: HTTP ${response.status}`);
    const data = await response.json();
    return data.photos ?? [];
  }
  async function searchVideos(query, apiKey) {
    const url = new URL(`${API}/videos/search`);
    url.searchParams.set("query", query);
    url.searchParams.set("orientation", "landscape");
    url.searchParams.set("per_page", "12");
    const response = await fetch(url, { headers: authHeaders(apiKey) });
    if (!response.ok) throw new Error(`Pexels vídeos: HTTP ${response.status}`);
    const data = await response.json();
    return data.videos ?? [];
  }
  const PLUGIN_TAG = "[Shalom Bíblia Inteligente]";
  let lastFingerprint = "";
  let busy = false;
  function collectStrings(value, out = [], depth = 0) {
    if (depth > 8 || value == null) return out;
    if (typeof value === "string") {
      if (value.trim()) out.push(value.trim());
    } else if (Array.isArray(value)) {
      for (const item of value) collectStrings(item, out, depth + 1);
    } else if (typeof value === "object") {
      for (const [key, item] of Object.entries(value)) {
        if (/url|uri|guid|id|color|font|path|thumbnail|src/i.test(key)) continue;
        collectStrings(item, out, depth + 1);
      }
    }
    return out;
  }
  function findBibleReference(text) {
    const pattern = /\b(?:Gênesis|Êxodo|Levítico|Números|Deuteronômio|Josué|Juízes|Rute|1\s?Samuel|2\s?Samuel|1\s?Reis|2\s?Reis|Salmos?|Provérbios|Eclesiastes|Isaías|Jeremias|Mateus|Marcos|Lucas|João|Atos|Romanos|1\s?Coríntios|2\s?Coríntios|Gálatas|Efésios|Filipenses|Colossenses|Hebreus|Tiago|1\s?Pedro|2\s?Pedro|Apocalipse)\s+\d{1,3}(?::\d{1,3}(?:-\d{1,3})?)?/i;
    return text.match(pattern)?.[0] ?? null;
  }
  async function analyzeOutput(output) {
    if (busy) return;
    busy = true;
    try {
      const layers = await spresenter.live.read(output);
      const strings = collectStrings(layers);
      const fullText = strings.join("\n");
      const reference = findBibleReference(fullText);
      if (!reference) return;
      const verseText = strings.filter((s) => s.length > 15 && !/^https?:/i.test(s)).join(" ").slice(0, 1800);
      const fingerprint = `${reference}|${verseText}`;
      if (fingerprint === lastFingerprint) return;
      lastFingerprint = fingerprint;
      const theme = classifyTheme(`${reference} ${verseText}`);
      console.info(PLUGIN_TAG, { reference, theme });
      const apiKey = await spresenter.storage.get("pexelsApiKey");
      if (!apiKey) {
        console.info(PLUGIN_TAG, "Versículo detectado. Configure a chave Pexels no armazenamento do plugin.");
        return;
      }
      const [photos, videos] = await Promise.all([
        searchPhotos(theme.query, apiKey).catch(() => []),
        searchVideos(theme.query, apiKey).catch(() => [])
      ]);
      await spresenter.storage.set("lastAnalysis", {
        reference,
        verseText,
        theme,
        photos: photos.slice(0, 6),
        videos: videos.slice(0, 6),
        analyzedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
      console.info(PLUGIN_TAG, `Encontrados ${photos.length} fotos e ${videos.length} vídeos.`);
    } catch (error) {
      console.error(PLUGIN_TAG, error);
    } finally {
      busy = false;
    }
  }
  spresenter.on("live", ({ output }) => {
    if (output != null) void analyzeOutput(String(output));
  });
  async function applyBackgroundAsset(_output, _backgroundLayer, _assetGuid) {
    throw new Error("Integração pendente: confirme o formato Presentation e a camada de fundo no SDK desta instalação antes de projetar.");
  }
  exports.applyBackgroundAsset = applyBackgroundAsset;
  Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
  return exports;
}({});
