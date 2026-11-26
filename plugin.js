// src/i18n.js
var TEXTS = {
  es: { news2: "Novedades", heroText: "Canales de TV en vivo: deportes, entretenimiento, noticias y m\xE1s.", statusOk: "{n} canales en la parrilla del sitio", statusBad: "No se pudo abrir la parrilla del sitio", cacheCleared: "Cach\xE9 vaciada.", checked: "Comprobado: {n} canales.", all: "Todos", sports: "Deportes", entertainment: "Entretenimiento", news: "Noticias", movies: "Pel\xEDculas", kids: "Infantil", education: "Educaci\xF3n", always: "24/7", option: "Opci\xF3n", noStream: "Este canal no est\xE1 disponible ahora. Prueba con otro.", siteDown: "No se pudo abrir la lista de canales." },
  en: { news2: "What's new", heroText: "Live TV channels: sports, entertainment, news and more.", statusOk: "{n} channels on the site's grid", statusBad: "Could not open the site's grid", cacheCleared: "Cache cleared.", checked: "Checked: {n} channels.", all: "All", sports: "Sports", entertainment: "Entertainment", news: "News", movies: "Movies", kids: "Kids", education: "Education", always: "24/7", option: "Option", noStream: "This channel is not available right now. Try another one.", siteDown: "Could not open the channel list." }
};
var pick = (lang) => String(lang || "").toLowerCase().startsWith("es") ? "es" : "en";
var sub = (s, vars) => vars ? Object.keys(vars).reduce((a, k) => a.split("{" + k + "}").join(String(vars[k])), s) : s;
var raw = (lang, key) => TEXTS[lang][key] || TEXTS.es[key] || key;
function t(key, vars) {
  return sub(raw(pick(kino.lang), key), vars);
}

// src/site.js
var BASE = "https://www.cablevisionhd.org";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:101.0) Gecko/20100101 Firefox/101.0";
var HLS_MIME = "application/x-mpegURL";
var CACHE_KEY = "channels";
var CACHE_MS = 10 * 60 * 1e3;
var STALE_MS = 7 * 24 * 60 * 60 * 1e3;
var RESOLVE_MS = 18e3;
var HEDGE_MS = 5e3;
var MAX_OPTIONS = 3;
var fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
var CATEGORIES = [
  { id: "sports", key: "sports", genre: "deportes", names: ["TUDN", "WWE", "Afizzionados", "Gol Peru", "Gol TV", "TNT SPORTS", "Fox Sports", "TYC Sports", "Movistar Deportes", "Movistar La Liga", "Movistar Liga De Campeones", "Dazn", "Bein", "Directv Sports", "Espn", "Fox Deportes", "Win Sports", "Claro Sports", "Sky Sports"] },
  { id: "entertainment", key: "entertainment", genre: "entretenimiento", names: ["Telefe", "El Trece", "Television Publica", "Telemundo", "Univision", "Pasiones", "Caracol", "RCN", "Latina", "America TV", "Willax", "ATV", "Las Estrellas", "Tl Novelas", "Galavision", "Azteca", "Canal 5", "Distrito Comedia", "Canal 13"] },
  { id: "news", key: "news", genre: "noticias", names: ["Telemundo 51", "CNN", "Noticias", "NTN24", "DW", "Euronews", "France 24"] },
  { id: "movies", key: "movies", genre: "peliculas", names: ["Movistar Accion", "Movistar Drama", "Universal Channel", "TNT", "TNT Series", "Star Channel", "Star Action", "Star Series", "Cinemax", "Space", "Syfy", "Warner Channel", "Cinecanal", "FX", "AXN", "AMC", "Studio Universal", "Multipremier", "Golden", "Sony", "DHE", "NEXT HD", "HBO"] },
  { id: "kids", key: "kids", genre: "infantil", names: ["Cartoon Network", "Tooncast", "Cartoonito", "Disney", "Nick"] },
  { id: "education", key: "education", genre: "documentales", names: ["Discovery", "History", "Animal Planet", "Nat Geo", "National Geographic"] },
  { id: "always", key: "always", genre: "otros", names: ["24/7"] }
];
function categoriesOf(title) {
  const f = fold(title);
  return CATEGORIES.filter((c) => c.names.some((n) => f.includes(fold(n)))).map((c) => c.id);
}
var decode = (s) => String(s || "").replace(/&amp;/g, "&").replace(/&#0?39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
function parseChannels(html) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const m of String(html || "").matchAll(/<a\s[^>]*class="[^"]*\bchannel\b[^"]*"[^>]*>([\s\S]*?)<\/a>/g)) {
    const href = (/\bhref="([^"]+)"/.exec(m[0]) || [])[1] || "";
    const slug = /\/([a-z0-9-]+-en-vivo)\.php(?:\?.*)?$/i.exec(href);
    if (!slug || seen.has(slug[1])) continue;
    const title = decode((/<div[^>]*class="[^"]*\bchannel-name\b[^"]*"[^>]*>([\s\S]*?)<\/div>/.exec(m[1]) || [])[1] || "").replace(/<[^>]+>/g, "").trim();
    if (!title) continue;
    const img = (/<img[^>]*\bsrc="([^"]+)"/.exec(m[1]) || [])[1];
    seen.add(slug[1]);
    out.push({ id: slug[1], title, logo: img ? new URL(decode(img), BASE + "/").href : void 0 });
  }
  return out;
}
async function fetchText(url, headers, { tries = 2, deadline } = {}) {
  let last;
  for (let n = 1; n <= tries; n++) {
    const left = deadline ? deadline - Date.now() : 12e3;
    if (left < 1e3) throw last || kino.error("timeout", "CablevisionHD: no time left for " + url);
    try {
      const r = await kino.fetch(url, { headers: { "User-Agent": UA, ...headers || {} }, timeoutMs: Math.min(8e3, left) });
      if (r.ok) return r.text();
      last = kino.error("unavailable", "CablevisionHD " + r.status + " " + url, { userMessage: t("siteDown") });
      if (r.status < 500 && r.status !== 429) throw last;
    } catch (e) {
      if (e === last || e && e.code === "host_not_allowed") throw e;
      last = e;
    }
    if (n < tries) await kino.sleep(500);
  }
  throw last;
}
function readChannels(maxAge) {
  try {
    const raw2 = kino.storage.get(CACHE_KEY);
    const e = raw2 ? JSON.parse(raw2) : null;
    if (e && Date.now() - e.at < maxAge && Array.isArray(e.v) && e.v.length) return e.v;
  } catch (_) {
  }
  return null;
}
async function allChannels() {
  const fresh = readChannels(CACHE_MS);
  if (fresh) return fresh;
  try {
    const list = parseChannels(await fetchText(BASE + "/", { Referer: BASE + "/" }));
    if (!list.length) throw kino.error("unavailable", "CablevisionHD: no channels on the home page", { userMessage: t("siteDown") });
    try {
      kino.storage.set(CACHE_KEY, JSON.stringify({ at: Date.now(), v: list }), { ttlMs: STALE_MS });
    } catch (_) {
    }
    return list;
  } catch (e) {
    const stale = readChannels(STALE_MS);
    if (!stale) throw e;
    kino.log("grid unavailable, showing the list kept before: " + (e && e.message || e));
    return stale;
  }
}
function setting(key, fallback) {
  try {
    const v = kino.config.get(key);
    return v === void 0 || v === null ? fallback : v;
  } catch (_) {
    return fallback;
  }
}
var toChannel = (c, categoryId) => {
  const out = { id: c.id, title: c.title, ref: c.id };
  if (c.logo) out.logo = c.logo;
  if (categoryId) out.categoryId = categoryId;
  return out;
};
async function liveCategories() {
  return [{ id: "all", title: t("all") }, ...CATEGORIES.map((c) => ({ id: c.id, title: t(c.key), genre: c.genre }))];
}
async function liveChannels({ categoryId } = {}) {
  const list = await allChannels();
  const items = (!categoryId || categoryId === "all" ? list : list.filter((c) => categoriesOf(c.title).includes(categoryId))).map((c) => toChannel(c, categoryId || "all"));
  return { items };
}
async function liveSearch({ query } = {}) {
  const q = fold(query);
  if (q.length < 2) return { items: [] };
  return { items: (await allChannels()).filter((c) => fold(c.title).includes(q)).map((c) => toChannel(c)) };
}
var liveItem = (c) => {
  const it = { id: c.id, ref: c.id, title: c.title, kind: "live" };
  if (c.logo) it.poster = c.logo;
  return it;
};
var inGroup = (list, groupId) => list.filter((c) => categoriesOf(c.title).includes(groupId));
var GROUP = (id) => CATEGORIES.find((c) => c.id === id);
var usedGroups = (list) => CATEGORIES.filter((g) => inGroup(list, g.id).length);
function rowOf(list, group) {
  const items = inGroup(list, group.id).slice(0, 20).map(liveItem);
  return items.length ? { id: group.id, title: t(group.key), items, ref: "cat:" + group.id, genre: group.genre } : null;
}
async function home() {
  const list = await allChannels();
  return usedGroups(list).slice(0, 6).map((g) => rowOf(list, g)).filter(Boolean);
}
async function browse(ref) {
  const m = /^cat:([a-z]+)$/.exec(String(ref || ""));
  const group = m && GROUP(m[1]);
  if (!group) return { items: [] };
  return { items: inGroup(await allChannels(), group.id).map(liveItem) };
}
async function search(arg) {
  const query = typeof arg === "string" ? { q: arg } : arg || {};
  const q = fold(query.q);
  if (q.length < 2) return [];
  let list = await allChannels();
  if (query.within) {
    const m = /^cat:([a-z]+)$/.exec(String(query.within));
    if (!m || !GROUP(m[1])) return null;
    list = inGroup(list, m[1]);
  }
  return list.filter((c) => fold(c.title).includes(q)).slice(0, 60).map(liveItem);
}
async function section({ tab } = {}) {
  const list = await allChannels();
  const groups = usedGroups(list);
  const tabs = [{ id: "todos", label: t("all") }, ...groups.map((g) => ({ id: g.id, label: t(g.key) }))];
  const chosen = tabs.some((x) => x.id === tab) ? tab : "todos";
  const rows = (chosen === "todos" ? groups.map((g) => rowOf(list, g)) : [rowOf(list, GROUP(chosen))]).filter(Boolean);
  const answer = { tabs, tab: chosen, rows };
  const first = rows.flatMap((r) => r.items)[0];
  if (first) {
    answer.hero = { title: first.title, text: t("heroText") };
    if (first.poster) answer.hero.image = first.poster;
  }
  return answer;
}
async function categories() {
  const list = await allChannels();
  return usedGroups(list).map((g) => {
    const first = inGroup(list, g.id)[0];
    const tile = { id: "g-" + g.id, title: t(g.key), ref: "cat:" + g.id };
    if (first && first.logo) tile.art = first.logo;
    return tile;
  });
}
async function settingsStatus() {
  try {
    return { info: t("statusOk").replace("{n}", String((await allChannels()).length)) };
  } catch (_) {
    return { info: t("statusBad") };
  }
}
async function action(key) {
  if (key === "clearCache") {
    try {
      kino.storage.remove(CACHE_KEY);
    } catch (_) {
    }
    return { message: t("cacheCleared") };
  }
  if (key === "check") {
    try {
      kino.storage.remove(CACHE_KEY);
      return { message: t("checked").replace("{n}", String((await allChannels()).length)) };
    } catch (_) {
      return { message: t("statusBad") };
    }
  }
  return { message: "" };
}
function parseOptions(html) {
  const block = (/const\s+SOURCES\s*=\s*\{([\s\S]*?)\}/.exec(String(html || "")) || [])[1] || "";
  const pairs = [...block.matchAll(/(\d+)\s*:\s*"([^"]+)"/g)].map((m) => [Number(m[1]), m[2].replace(/\\\//g, "/")]).sort((a, b) => a[0] - b[0]);
  return [...new Set(pairs.map((p) => new URL(decode(p[1]), BASE + "/").href))];
}
function parseIframe(html) {
  const src = (/<iframe[^>]*\bsrc="([^"]+)"/i.exec(String(html || "")) || [])[1];
  return src ? new URL(decode(src), BASE + "/").href : null;
}
function parsePlaylist(html) {
  const s = String(html || "");
  const direct = (/\bvar\s+src\s*=\s*"([^"]+)"/.exec(s) || [])[1];
  if (direct) return direct.replace(/\\\//g, "/").replace(/\\:/g, ":");
  const b64 = (/\bvar\s+playbackURL\s*=\s*atob\("([^"]+)"\)/.exec(s) || [])[1];
  if (b64) {
    try {
      return atob(b64);
    } catch (_) {
      return null;
    }
  }
  return null;
}
async function streamFromOption(optionUrl, channelUrl, label, deadline) {
  const core = await fetchText(optionUrl, { Referer: channelUrl }, { tries: 1, deadline });
  const iframe = parseIframe(core);
  if (!iframe) return null;
  const player = await fetchText(iframe, { Referer: optionUrl }, { tries: 1, deadline });
  const url = parsePlaylist(player);
  if (!url || !/^https?:\/\//i.test(url)) return null;
  const origin = /^https?:\/\/[^/]+/.exec(iframe)[0];
  const headers = { "User-Agent": UA, Referer: origin + "/" };
  if (setting("verify", true) !== false) {
    try {
      const r = await kino.fetch(url, { headers, timeoutMs: Math.max(1e3, Math.min(5e3, deadline - Date.now())) });
      if (!r.ok || !String(await r.text()).includes("#EXTM3U")) return null;
    } catch (_) {
    }
  }
  return { url, mime: HLS_MIME, headers, label };
}
function firstOpening(order, run) {
  return new Promise((resolve2) => {
    let next = 0, pending = 0, done = false;
    const failures = [];
    const launch = () => {
      if (done || next >= order.length) return false;
      const i = order[next++];
      pending++;
      run(i).then(
        (stream) => {
          if (stream) {
            if (!done) {
              done = true;
              resolve2({ stream, i });
            }
          } else failures.push(`option ${i + 1}: no playlist`);
        },
        (e) => {
          failures.push(`option ${i + 1}: ${e && e.message || e}`);
        }
      ).then(() => {
        pending--;
        if (!done && !launch() && pending === 0) {
          done = true;
          resolve2({ failures });
        }
      });
      return true;
    };
    launch();
    (async () => {
      while (!done && next < order.length) {
        await kino.sleep(HEDGE_MS);
        if (!done) launch();
      }
    })();
  });
}
async function resolve(ref) {
  const m = /^([a-z0-9-]+-en-vivo)(?:\|([1-9]))?$/i.exec(String(ref || ""));
  if (!m) throw kino.error("not_found", "unknown ref: " + ref);
  const deadline = Date.now() + RESOLVE_MS;
  const channelUrl = `${BASE}/${m[1]}.php`;
  const options = parseOptions(await fetchText(channelUrl, { Referer: BASE + "/" }, { deadline })).slice(0, MAX_OPTIONS);
  if (!options.length) throw kino.error("not_found", "no options on " + channelUrl, { userMessage: t("noStream") });
  const preferred = Number(setting("option", "auto"));
  const order = options.map((_, i) => i);
  if (preferred >= 1 && preferred <= options.length) order.unshift(...order.splice(preferred - 1, 1));
  const wanted = m[2] ? [Number(m[2]) - 1].filter((i) => options[i]) : order;
  const out = await firstOpening(wanted, (i) => streamFromOption(options[i], channelUrl, `${t("option")} ${i + 1}`, deadline));
  if (out.stream) {
    const { stream, i } = out;
    if (!m[2]) {
      const others = options.map((_, j) => j).filter((j) => j !== i);
      if (others.length) stream.alternatives = others.map((j) => ({ ref: `${m[1]}|${j + 1}`, label: `${t("option")} ${j + 1}` }));
    }
    return stream;
  }
  kino.log("resolve " + m[1] + " failed: " + (out.failures || []).join("; "));
  throw kino.error("not_found", "no playable option for " + m[1], { userMessage: t("noStream") });
}

// src/plugin.js
globalThis.__kinoDropPendingFetches = true;
export {
  action,
  browse,
  categories,
  home,
  liveCategories,
  liveChannels,
  liveSearch,
  resolve,
  search,
  section,
  settingsStatus
};
