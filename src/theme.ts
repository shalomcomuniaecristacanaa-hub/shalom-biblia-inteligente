export type ThemeResult = {
  theme: string;
  mood: string;
  query: string;
  media: "photo" | "video";
};

const rules: Array<[string, string[], string, string]> = [
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

export function classifyTheme(text: string): ThemeResult {
  const normalized = text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const found = rules.find(([, words]) => words.some(w =>
    normalized.includes(w.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase())
  ));
  const [theme, mood, query] = found
    ? [found[0], found[2], found[3]]
    : ["bíblia", "contemplação", "biblical landscape dramatic cinematic background"];
  return { theme, mood, query, media: "photo" };
}
