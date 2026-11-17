import { classifyTheme } from "./theme";
import { searchPhotos, searchVideos } from "./media";

const PLUGIN_TAG = "[Shalom Bíblia Inteligente]";
let lastFingerprint = "";
let busy = false;

function collectStrings(value: unknown, out: string[] = [], depth = 0): string[] {
  if (depth > 8 || value == null) return out;
  if (typeof value === "string") {
    if (value.trim()) out.push(value.trim());
  } else if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out, depth + 1);
  } else if (typeof value === "object") {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (/url|uri|guid|id|color|font|path|thumbnail|src/i.test(key)) continue;
      collectStrings(item, out, depth + 1);
    }
  }
  return out;
}

function findBibleReference(text: string): string | null {
  const pattern = /\b(?:Gênesis|Êxodo|Levítico|Números|Deuteronômio|Josué|Juízes|Rute|1\s?Samuel|2\s?Samuel|1\s?Reis|2\s?Reis|Salmos?|Provérbios|Eclesiastes|Isaías|Jeremias|Mateus|Marcos|Lucas|João|Atos|Romanos|1\s?Coríntios|2\s?Coríntios|Gálatas|Efésios|Filipenses|Colossenses|Hebreus|Tiago|1\s?Pedro|2\s?Pedro|Apocalipse)\s+\d{1,3}(?::\d{1,3}(?:-\d{1,3})?)?/i;
  return text.match(pattern)?.[0] ?? null;
}

async function analyzeOutput(output: string) {
  if (busy) return;
  busy = true;
  try {
    const layers = await spresenter.live.read(output);
    const strings = collectStrings(layers);
    const fullText = strings.join("\n");
    const reference = findBibleReference(fullText);
    if (!reference) return;

    const verseText = strings.filter(s => s.length > 15 && !/^https?:/i.test(s)).join(" ").slice(0, 1800);
    const fingerprint = `${reference}|${verseText}`;
    if (fingerprint === lastFingerprint) return;
    lastFingerprint = fingerprint;

    const theme = classifyTheme(`${reference} ${verseText}`);
    console.info(PLUGIN_TAG, { reference, theme });
    const apiKey = await spresenter.storage.get<string>("pexelsApiKey");
    if (!apiKey) {
      console.info(PLUGIN_TAG, "Versículo detectado. Configure a chave Pexels no armazenamento do plugin.");
      return;
    }
    const [photos, videos] = await Promise.all([
      searchPhotos(theme.query, apiKey).catch(() => []),
      searchVideos(theme.query, apiKey).catch(() => [])
    ]);
    await spresenter.storage.set("lastAnalysis", {
      reference, verseText, theme, photos: photos.slice(0, 6), videos: videos.slice(0, 6), analyzedAt: new Date().toISOString()
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

// Integração de projeção desativada até validar o objeto Presentation e a camada de fundo.
export async function applyBackgroundAsset(_output: string, _backgroundLayer: number, _assetGuid: string): Promise<never> {
  throw new Error("Integração pendente: confirme o formato Presentation e a camada de fundo no SDK desta instalação antes de projetar.");
}
