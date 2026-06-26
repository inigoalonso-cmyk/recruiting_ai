export type Lang = "en" | "es";

export const dict = {
  en: {
    title: "Candidate Finder",
    subtitle: "Describe who you're looking for. Get matching candidates.",
    placeholder: "Looking for a product designer in Berlin fluent in German",
    job: "Job / pipeline",
    allJobs: "Select a job",
    scopeJob: "This job",
    scopePool: "Whole pool",
    role: "Saved criteria",
    none: "None",
    freshness: "Last activity",
    freshnessAny: "Any time",
    months: "+ months untouched",
    limit: "Results",
    search: "Search",
    searching: "Searching…",
    empty: "No matching candidates.",
    error: "Something went wrong. Try again.",
    openAshby: "Open in Ashby",
    viewLinkedin: "View LinkedIn",
    languages: "Languages",
    exportCsv: "Export CSV",
    copyList: "Copy list",
    copied: "Copied!",
    selected: "selected",
    signIn: "Sign in with Google",
    signOut: "Sign out",
    gate: "Sign in with your @happyrobot.ai account to continue.",
  },
  es: {
    title: "Buscador de candidatos",
    subtitle: "Describe a quién buscas. Recibe los candidatos que encajan.",
    placeholder: "Busco a alguien de San Francisco que hable francés con experiencia en diseño de producto",
    job: "Puesto / pipeline",
    allJobs: "Elige un puesto",
    scopeJob: "Este puesto",
    scopePool: "Todo el pool",
    role: "Criterios guardados",
    none: "Ninguno",
    freshness: "Última actividad",
    freshnessAny: "Cualquier momento",
    months: "+ meses sin tocar",
    limit: "Resultados",
    search: "Buscar",
    searching: "Buscando…",
    empty: "No hay candidatos que encajen.",
    error: "Algo salió mal. Inténtalo de nuevo.",
    openAshby: "Abrir en Ashby",
    viewLinkedin: "Ver LinkedIn",
    languages: "Idiomas",
    exportCsv: "Exportar CSV",
    copyList: "Copiar lista",
    copied: "¡Copiado!",
    selected: "seleccionados",
    signIn: "Entrar con Google",
    signOut: "Salir",
    gate: "Entra con tu cuenta @happyrobot.ai para continuar.",
  },
} as const;

/** Best-effort: detect Spanish from accented chars / common ES words, else English. */
export function detectLang(text: string): Lang {
  if (!text) return "en";
  if (/[áéíóúñ¿¡]/i.test(text)) return "es";
  const es = /\b(busco|que|hable|con|experiencia|alguien|años|diseñador|ingeniero|en)\b/i;
  return es.test(text) ? "es" : "en";
}
