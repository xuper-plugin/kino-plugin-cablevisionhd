// User-facing texts (es/en) for CablevisionHD, and the helpers to read them.
export const TEXTS = {
  es: { news2: "Novedades", heroText: "Canales de TV en vivo: deportes, entretenimiento, noticias y más.", statusOk: "{n} canales en la parrilla del sitio", statusBad: "No se pudo abrir la parrilla del sitio", cacheCleared: "Caché vaciada.", checked: "Comprobado: {n} canales.", all: "Todos", sports: "Deportes", entertainment: "Entretenimiento", news: "Noticias", movies: "Películas", kids: "Infantil", education: "Educación", always: "24/7", option: "Opción", noStream: "Este canal no está disponible ahora. Prueba con otro.", siteDown: "No se pudo abrir la lista de canales.", title: "CablevisionHD", search: "Buscar", searchHint: "Buscar canal", settings: "Ajustes", back: "Atrás", retry: "Reintentar", empty: "No hay canales en este grupo.", noResults: "Sin resultados.", refresh: "Actualizar la parrilla", clear: "Vaciar caché", signalTitle: "Señal" },
  en: { news2: "What's new", heroText: "Live TV channels: sports, entertainment, news and more.", statusOk: "{n} channels on the site's grid", statusBad: "Could not open the site's grid", cacheCleared: "Cache cleared.", checked: "Checked: {n} channels.", all: "All", sports: "Sports", entertainment: "Entertainment", news: "News", movies: "Movies", kids: "Kids", education: "Education", always: "24/7", option: "Option", noStream: "This channel is not available right now. Try another one.", siteDown: "Could not open the channel list.", title: "CablevisionHD", search: "Search", searchHint: "Search channel", settings: "Settings", back: "Back", retry: "Retry", empty: "No channels in this group.", noResults: "No results.", refresh: "Refresh the grid", clear: "Clear cache", signalTitle: "Signal" },
};

const pick = (lang) => (String(lang || "").toLowerCase().startsWith("es") ? "es" : "en");
const sub = (s, vars) => (vars ? Object.keys(vars).reduce((a, k) => a.split("{" + k + "}").join(String(vars[k])), s) : s);
const raw = (lang, key) => TEXTS[lang][key] || TEXTS.es[key] || key;

/** The text for `key` in the app's current language. */
export function t(key, vars) {
  return sub(raw(pick(kino.lang), key), vars);
}

/** Both languages of `key` as a widget prop pair, e.g. `twin("all")` -> `{ label: "Todos", labelEn: "All" }`. */
export function twin(key, prop = "label", vars) {
  return { [prop]: sub(raw("es", key), vars), [prop + "En"]: sub(raw("en", key), vars) };
}
