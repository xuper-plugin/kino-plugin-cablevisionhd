// src/i18n.js
var TEXTS = {
  es: { news2: "Novedades", heroText: "Canales de TV en vivo: deportes, entretenimiento, noticias y m\xE1s.", statusOk: "{n} canales en la parrilla del sitio", statusBad: "No se pudo abrir la parrilla del sitio", cacheCleared: "Cach\xE9 vaciada.", checked: "Comprobado: {n} canales.", all: "Todos", sports: "Deportes", entertainment: "Entretenimiento", news: "Noticias", movies: "Pel\xEDculas", kids: "Infantil", education: "Educaci\xF3n", always: "24/7", option: "Opci\xF3n", noStream: "Este canal no est\xE1 disponible ahora. Prueba con otro.", siteDown: "No se pudo abrir la lista de canales.", title: "CablevisionHD", search: "Buscar", searchHint: "Buscar canal", settings: "Ajustes", back: "Atr\xE1s", retry: "Reintentar", empty: "No hay canales en este grupo.", noResults: "Sin resultados.", refresh: "Actualizar la parrilla", clear: "Vaciar cach\xE9", signalTitle: "Se\xF1al" },
  en: { news2: "What's new", heroText: "Live TV channels: sports, entertainment, news and more.", statusOk: "{n} channels on the site's grid", statusBad: "Could not open the site's grid", cacheCleared: "Cache cleared.", checked: "Checked: {n} channels.", all: "All", sports: "Sports", entertainment: "Entertainment", news: "News", movies: "Movies", kids: "Kids", education: "Education", always: "24/7", option: "Option", noStream: "This channel is not available right now. Try another one.", siteDown: "Could not open the channel list.", title: "CablevisionHD", search: "Search", searchHint: "Search channel", settings: "Settings", back: "Back", retry: "Retry", empty: "No channels in this group.", noResults: "No results.", refresh: "Refresh the grid", clear: "Clear cache", signalTitle: "Signal" }
};
var pick = (lang) => String(lang || "").toLowerCase().startsWith("es") ? "es" : "en";
var sub = (s, vars) => vars ? Object.keys(vars).reduce((a, k) => a.split("{" + k + "}").join(String(vars[k])), s) : s;
var raw = (lang, key) => TEXTS[lang][key] || TEXTS.es[key] || key;
function t(key, vars) {
  return sub(raw(pick(kino.lang), key), vars);
}
function twin(key, prop = "label", vars) {
  return { [prop]: sub(raw("es", key), vars), [prop + "En"]: sub(raw("en", key), vars) };
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
async function search(arg) {
  const q = fold(typeof arg === "string" ? arg : arg && arg.q || "");
  if (q.length < 2) return [];
  return (await allChannels()).filter((c) => fold(c.title).includes(q)).slice(0, 60).map((c) => {
    const it = { id: c.id, ref: c.id, title: c.title, kind: "live" };
    if (c.logo) it.poster = c.logo;
    return it;
  });
}
var inGroup = (list, groupId) => list.filter((c) => categoriesOf(c.title).includes(groupId));
var usedGroups = (list) => CATEGORIES.filter((g) => inGroup(list, g.id).length);
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

// src/ui.js
var ROUTES = ["main", "search", "settings"];
var GRID_CAP = 120;
function channelCard(c) {
  const out = { id: c.id, ref: c.id, title: c.title, kind: "live" };
  if (c.logo) out.poster = c.logo;
  return out;
}
function roundChannel(c) {
  return {
    type: "Column",
    key: "ch-" + c.id,
    w: 120,
    gap: 8,
    crossAxisAlignment: "center",
    onTap: { go: { play: { ref: c.id, kind: "live", id: c.id, title: c.title } } },
    children: [
      { type: "CircleAvatar", key: "chl-" + c.id, radius: 44, ...c.logo ? { image: c.logo } : { text: String(c.title).slice(0, 2).toUpperCase() }, labelText: c.title, labelTextEn: c.title },
      { type: "Text", text: c.title, textEn: c.title, style: "caption", maxLines: 1, textAlign: "center" }
    ]
  };
}
function tabsOf(list) {
  return [{ id: "all", ...twin("all") }, ...usedGroups(list).map((g) => ({ id: g.id, ...twin(g.key) }))];
}
function channelsInTab(list, tab) {
  return !tab || tab === "all" ? list : inGroup(list, tab);
}
var brand = () => ({ type: "Text", key: "brand", text: t("title"), textEn: "CablevisionHD", style: "h4" });
var barBtn = (key, icon, labelKey, onPressed) => ({ type: "IconButton", key, icon, ...twin(labelKey, "labelText"), ...twin(labelKey, "tooltip"), onPressed });
var tabBar = (active, tabs) => ({ type: "TabBar", key: "tabs", divider: false, value: active, onChanged: "tab", tabs: tabs.map((x) => ({ value: x.id, label: x.label, labelEn: x.labelEn })) });
var scroll = (key, children) => ({ type: "SingleChildScrollView", key, children: [{ type: "Column", padding: { compact: 12, expanded: 24 }, gap: 16, children }] });
var backBar = (titleKey) => ({ type: "AppBar", mergeWithKinoBar: true, dense: true, divider: false, leading: barBtn("back", "arrow_back", "back", { event: "go", arg: "main" }), ...twin(titleKey, "title") });
function mainView({ list, tab, device }) {
  const tv = device === "tv";
  const tabs = tabsOf(list);
  const active = tabs.some((x) => x.id === tab) ? tab : "all";
  const channels = channelsInTab(list, active);
  const body = channels.length === 0 ? { type: "Text", ...twin("empty", "text"), color: "muted" } : tv ? { type: "Row", key: "channels", wrap: true, gap: 24, children: channels.slice(0, GRID_CAP).map(roundChannel) } : { type: "titleGrid", key: "grid-" + active, columns: { compact: 3, expanded: 6 }, items: channels.slice(0, GRID_CAP).map(channelCard) };
  return {
    type: "Scaffold",
    appBar: {
      type: "AppBar",
      mergeWithKinoBar: true,
      dense: true,
      divider: false,
      title: brand(),
      actions: [barBtn("searchBtn", "search", "search", { event: "go", arg: "search" }), barBtn("settingsBtn", "settings", "settings", { event: "go", arg: "settings" })]
    },
    body: {
      type: "Column",
      key: "page",
      children: [
        { type: "Column", key: "tabsRow", padding: { compact: 0, expanded: 24 }, children: [tabBar(active, tabs)] },
        { type: "SingleChildScrollView", key: "browse-" + active, flex: 1, children: [{ type: "Column", padding: { compact: 12, expanded: 24 }, gap: 16, children: [body] }] }
      ]
    }
  };
}
function searchView({ list, query, device }) {
  const q = fold(query || "");
  const results = q.length >= 2 ? list.filter((c) => fold(c.title).includes(q)).slice(0, GRID_CAP) : [];
  const tv = device === "tv";
  const body = [
    {
      type: "Form",
      key: "searchForm",
      onSubmitted: "q",
      gap: 8,
      children: [{ type: "TextField", key: "q", kind: "text", value: query || "", ...twin("searchHint", "labelText"), maxLength: 80, autofocus: true, onSubmitted: "q" }]
    }
  ];
  if (q.length >= 2) {
    if (results.length === 0) body.push({ type: "Text", ...twin("noResults", "text"), color: "muted" });
    else if (tv) body.push({ type: "Row", key: "results", wrap: true, gap: 24, children: results.map(roundChannel) });
    else body.push({ type: "titleGrid", key: "results", columns: { compact: 3, expanded: 6 }, items: results.map(channelCard) });
  }
  return { type: "Scaffold", appBar: backBar("search"), body: scroll("search-page", body) };
}
function settingsView({ info, device }) {
  return {
    type: "Scaffold",
    appBar: backBar("settings"),
    body: scroll("settings-page", [
      { type: "Card", key: "signalCard", children: [
        { type: "Text", ...twin("signalTitle", "text"), style: "h4" },
        { type: "settings", key: "signalForm", keys: ["option", "verify"], autoSave: true, onSaved: "saved" }
      ] },
      { type: "Card", key: "gridCard", children: [
        { type: "Row", key: "gridButtons", wrap: true, gap: 8, children: [
          { type: "ElevatedButton", key: "refresh", ...twin("refresh", "labelText"), icon: "refresh", onPressed: "check" },
          { type: "Button", variant: "secondary", key: "clear", ...twin("clear", "labelText"), icon: "delete", onPressed: "clearCache" }
        ] },
        { type: "Text", text: info || "", textEn: info || "", style: "caption", color: "muted" }
      ] }
    ])
  };
}
function errorView() {
  return {
    type: "Scaffold",
    appBar: { type: "AppBar", mergeWithKinoBar: true, dense: true, divider: false, title: brand() },
    body: scroll("error-page", [
      { type: "MaterialBanner", key: "loadFailed", role: "error", ...twin("siteDown"), action: { ...twin("retry", "label"), onTap: "retry" } }
    ])
  };
}
async function screen(ctx) {
  const c = ctx && typeof ctx === "object" ? ctx : {};
  const state = c.state && typeof c.state === "object" ? c.state : {};
  const name = c.route && ROUTES.includes(c.route.name) ? c.route.name : "main";
  try {
    if (name === "settings") {
      const s = await settingsStatus();
      return settingsView({ info: s.info, device: c.device });
    }
    const list = await allChannels();
    if (name === "search") return searchView({ list, query: typeof state.q === "string" ? state.q : "", device: c.device });
    return mainView({ list, tab: typeof state.tab === "string" ? state.tab : "all", device: c.device });
  } catch (_) {
    return errorView();
  }
}
var bump = (state) => ({ n: (state.n || 0) + 1 });
var pickStr = (value, arg) => typeof value === "string" ? value : typeof arg === "string" ? arg : "";
var events = {
  tab({ value, arg, state }) {
    return { state: { ...state, tab: pickStr(value, arg) || "all", ...bump(state) } };
  },
  q({ value, arg, state }) {
    return { state: { ...state, q: pickStr(value, arg), ...bump(state) } };
  },
  retry({ state }) {
    return { state: { ...state, ...bump(state) } };
  },
  async check({ state }) {
    const r = await action("check");
    return { toast: { text: r.message }, state: { ...state, ...bump(state) } };
  },
  async clearCache({ state }) {
    const r = await action("clearCache");
    return { toast: { text: r.message }, state: { ...state, ...bump(state) } };
  },
  saved({ state }) {
    return { state: { ...state, ...bump(state) } };
  }
};
async function screenEvent(ev) {
  const e = ev && typeof ev === "object" ? ev : {};
  const handler = Object.hasOwn(events, e.name) ? events[e.name] : null;
  if (!handler) return null;
  try {
    return await handler({ ...e, state: e.state && typeof e.state === "object" ? e.state : {} }) ?? null;
  } catch (_) {
    return { toast: { text: t("siteDown"), role: "error" } };
  }
}

// src/plugin.js
globalThis.__kinoDropPendingFetches = true;
export {
  action,
  liveCategories,
  liveChannels,
  liveSearch,
  resolve,
  screen,
  screenEvent,
  search,
  settingsStatus
};
