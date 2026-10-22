// Kino plugin: CablevisionHD -- live TV channels from cablevisionhd.com.
// The site lists its channels on one page (/parrilla-directo.php). A channel page offers up to three options; each option's
// core.php answers a page with one iframe, and that player page names the HLS playlist in `var src = "...m3u8?token=..."`.

const BASE = "https://www.cablevisionhd.com";
// The site answers a plain browser; the same User-Agent goes on every request of a resolve.
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:101.0) Gecko/20100101 Firefox/101.0";
const HLS_MIME = "application/x-mpegURL";
const CACHE_KEY = "channels";
const CACHE_MS = 10 * 60 * 1000;
const MAX_OPTIONS = 3;

const TEXTS = {
  es: { all: "Todos", sports: "Deportes", entertainment: "Entretenimiento", news: "Noticias", movies: "Películas", kids: "Infantil", education: "Educación", always: "24/7", option: "Opción", noStream: "Este canal no está disponible ahora. Prueba con otro.", siteDown: "No se pudo abrir la lista de canales." },
  en: { all: "All", sports: "Sports", entertainment: "Entertainment", news: "News", movies: "Movies", kids: "Kids", education: "Education", always: "24/7", option: "Option", noStream: "This channel is not available right now. Try another one.", siteDown: "Could not open the channel list." },
};
function t(key) {
  const lang = String(kino.lang || "").toLowerCase().startsWith("es") ? "es" : "en";
  return TEXTS[lang][key] || TEXTS.es[key] || key;
}

// ---- categories ------------------------------------------------------------------------------------------------
// The site has none: the channels are sorted by name, as the CloudStream provider did.

const fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const CATEGORIES = [
  { id: "sports", key: "sports", genre: "deportes", names: ["TUDN", "WWE", "Afizzionados", "Gol Peru", "Gol TV", "TNT SPORTS", "Fox Sports", "TYC Sports", "Movistar Deportes", "Movistar La Liga", "Movistar Liga De Campeones", "Dazn", "Bein", "Directv Sports", "Espn", "Fox Deportes", "Win Sports", "Claro Sports", "Sky Sports"] },
  { id: "entertainment", key: "entertainment", genre: "entretenimiento", names: ["Telefe", "El Trece", "Television Publica", "Telemundo", "Univision", "Pasiones", "Caracol", "RCN", "Latina", "America TV", "Willax", "ATV", "Las Estrellas", "Tl Novelas", "Galavision", "Azteca", "Canal 5", "Distrito Comedia", "Canal 13"] },
  { id: "news", key: "news", genre: "noticias", names: ["Telemundo 51", "CNN", "Noticias", "NTN24", "DW", "Euronews", "France 24"] },
  { id: "movies", key: "movies", genre: "peliculas", names: ["Movistar Accion", "Movistar Drama", "Universal Channel", "TNT", "TNT Series", "Star Channel", "Star Action", "Star Series", "Cinemax", "Space", "Syfy", "Warner Channel", "Cinecanal", "FX", "AXN", "AMC", "Studio Universal", "Multipremier", "Golden", "Sony", "DHE", "NEXT HD", "HBO"] },
  { id: "kids", key: "kids", genre: "infantil", names: ["Cartoon Network", "Tooncast", "Cartoonito", "Disney", "Nick"] },
  { id: "education", key: "education", genre: "documentales", names: ["Discovery", "History", "Animal Planet", "Nat Geo", "National Geographic"] },
  { id: "always", key: "always", genre: "otros", names: ["24/7"] },
];

/** The category ids a channel title belongs to (a title can sit in more than one). */
function categoriesOf(title) {
  const f = fold(title);
  return CATEGORIES.filter((c) => c.names.some((n) => f.includes(fold(n)))).map((c) => c.id);
}

// ---- the channel list ------------------------------------------------------------------------------------------

const decode = (s) => String(s || "").replace(/&amp;/g, "&").replace(/&#0?39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();

/** Every channel card of the grid page: `{ id, title, logo }`. A card that is not a channel page ("-ver.php") is left out. */
function parseChannels(html) {
  const out = [];
  const seen = new Set();
  for (const m of String(html || "").matchAll(/<a\s+href="([^"]+)"[^>]*class="[^"]*\bchannel-card\b[^"]*"[^>]*>([\s\S]*?)<\/a>/g)) {
    const slug = /\/([a-z0-9-]+-ver)\.php(?:\?.*)?$/i.exec(m[1]);
    if (!slug || seen.has(slug[1])) continue;
    const title = decode((/<p[^>]*>([\s\S]*?)<\/p>/.exec(m[2]) || [])[1] || "").replace(/<[^>]+>/g, "").trim();
    if (!title) continue;
    const img = (/<img[^>]*\bsrc="([^"]+)"/.exec(m[2]) || [])[1];
    seen.add(slug[1]);
    out.push({ id: slug[1], title, logo: img ? new URL(decode(img), BASE + "/").href : undefined });
  }
  return out;
}

async function fetchText(url, headers) {
  const r = await kino.fetch(url, { headers: { "User-Agent": UA, ...(headers || {}) }, timeoutMs: 12000 });
  if (!r.ok) throw kino.error("unavailable", "CablevisionHD " + r.status + " " + url);
  return r.text();
}

async function allChannels() {
  try {
    const raw = kino.storage.get(CACHE_KEY);
    const e = raw ? JSON.parse(raw) : null;
    if (e && Date.now() - e.at < CACHE_MS && Array.isArray(e.v) && e.v.length) return e.v;
  } catch (_) { /* no cache */ }
  const list = parseChannels(await fetchText(BASE + "/parrilla-directo.php", { Referer: BASE + "/" }));
  if (!list.length) throw kino.error("unavailable", "CablevisionHD: no channels on the grid page", { userMessage: t("siteDown") });
  try { kino.storage.set(CACHE_KEY, JSON.stringify({ at: Date.now(), v: list }), { ttlMs: CACHE_MS }); } catch (_) { /* the list is small; a full storage only costs a refetch */ }
  return list;
}

const toChannel = (c, categoryId) => {
  const out = { id: c.id, title: c.title, ref: c.id };
  if (c.logo) out.logo = c.logo;
  if (categoryId) out.categoryId = categoryId;
  return out;
};

// ---- exports ---------------------------------------------------------------------------------------------------

export async function home() { return []; }

export async function liveCategories() {
  return [{ id: "all", title: t("all") }, ...CATEGORIES.map((c) => ({ id: c.id, title: t(c.key), genre: c.genre }))];
}

export async function liveChannels({ categoryId } = {}) {
  const list = await allChannels();
  const items = (!categoryId || categoryId === "all" ? list : list.filter((c) => categoriesOf(c.title).includes(categoryId))).map((c) => toChannel(c, categoryId || "all"));
  return { items };
}

export async function liveSearch({ query } = {}) {
  const q = fold(query);
  if (q.length < 2) return { items: [] };
  return { items: (await allChannels()).filter((c) => fold(c.title).includes(q)).map((c) => toChannel(c)) };
}

// ---- resolve ---------------------------------------------------------------------------------------------------

/** The options of a channel page: the `href` of each `a.option`, absolute. */
function parseOptions(html) {
  const out = [];
  for (const m of String(html || "").matchAll(/<a\s[^>]*class="[^"]*\boption\b[^"]*"[^>]*>/g)) {
    const href = (/\bhref="([^"]+)"/.exec(m[0]) || [])[1];
    if (href) out.push(new URL(decode(href), BASE + "/").href);
  }
  return [...new Set(out)];
}

/** The player iframe of an option's core.php. */
function parseIframe(html) {
  const src = (/<iframe[^>]*\bsrc="([^"]+)"/i.exec(String(html || "")) || [])[1];
  return src ? new URL(decode(src), BASE + "/").href : null;
}

/** The playlist address a player page names: `var src = "https:\/\/host\/playlist\/1\/index.m3u8?token=..."`. */
function parsePlaylist(html) {
  const s = String(html || "");
  const direct = (/\bvar\s+src\s*=\s*"([^"]+)"/.exec(s) || [])[1];
  if (direct) return direct.replace(/\\\//g, "/").replace(/\\:/g, ":");
  const b64 = (/\bvar\s+playbackURL\s*=\s*atob\("([^"]+)"\)/.exec(s) || [])[1];
  if (b64) {
    try { return atob(b64); } catch (_) { return null; }
  }
  return null;
}

async function streamFromOption(optionUrl, channelUrl, label) {
  const core = await fetchText(optionUrl, { Referer: channelUrl });
  const iframe = parseIframe(core);
  if (!iframe) return null;
  const player = await fetchText(iframe, { Referer: BASE + "/" });
  const url = parsePlaylist(player);
  if (!url || !/^https?:\/\//i.test(url)) return null;
  const origin = /^https?:\/\/[^/]+/.exec(iframe)[0];
  const headers = { "User-Agent": UA, Referer: origin + "/" };
  // A channel that is off air still has a playlist address; it answers 404 (or a page). Looking first lets resolve move on to the
  // next option instead of handing the player a dead address. The playlist's host is the player's, which `kino.fetch` may not reach:
  // then the check is skipped and the player finds out.
  try {
    const r = await kino.fetch(url, { headers, timeoutMs: 8000 });
    if (!r.ok || !String(await r.text()).includes("#EXTM3U")) return null;
  } catch (_) { /* not reachable from here: trust it */ }
  return { url, mime: HLS_MIME, headers, label };
}

/** `ref` is a channel id ("tudn-ver"), or "<id>|<n>" for the n-th option of that channel. */
export async function resolve(ref) {
  const m = /^([a-z0-9-]+-ver)(?:\|([1-9]))?$/i.exec(String(ref || ""));
  if (!m) throw kino.error("not_found", "unknown ref: " + ref);
  const channelUrl = `${BASE}/${m[1]}.php`;
  const options = parseOptions(await fetchText(channelUrl, { Referer: BASE + "/parrilla-directo.php" })).slice(0, MAX_OPTIONS);
  if (!options.length) throw kino.error("not_found", "no options on " + channelUrl, { userMessage: t("noStream") });
  const wanted = m[2] ? [Number(m[2]) - 1] : options.map((_, i) => i);
  const failures = [];
  for (const i of wanted) {
    if (!options[i]) continue;
    try {
      const stream = await streamFromOption(options[i], channelUrl, `${t("option")} ${i + 1}`);
      if (!stream) { failures.push(`option ${i + 1}: no playlist`); continue; }
      if (!m[2]) {
        const others = options.map((_, j) => j).filter((j) => j !== i);
        if (others.length) stream.alternatives = others.map((j) => ({ ref: `${m[1]}|${j + 1}`, label: `${t("option")} ${j + 1}` }));
      }
      return stream;
    } catch (e) {
      failures.push(`option ${i + 1}: ${(e && e.message) || e}`);
    }
  }
  kino.log("resolve " + m[1] + " failed: " + failures.join("; "));
  throw kino.error("not_found", "no playable option for " + m[1], { userMessage: t("noStream") });
}
