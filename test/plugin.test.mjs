// node --test test/plugin.test.mjs
// Offline: a fake www.cablevisionhd.org (home grid, channel pages, option core pages, players) and a stub of `kino`.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateManifest } from "../sdk/contract.mjs";

const calls = [];
let pages = {};
let logs = [];
let store = new Map();
let lang = "es";
let cfg = {};
globalThis.kino = {
  get lang() { return lang; },
  config: { get: (k) => cfg[k] },
  fetch: async (url, opts = {}) => {
    calls.push({ url, opts });
    const p = pages[url];
    if (!p) return { ok: false, status: 404, text: () => "", json: () => ({}) };
    const status = p.status ?? 200;
    return { ok: status < 400, status, text: () => p.body, json: () => JSON.parse(p.body) };
  },
  storage: { get: (k) => store.get(k) ?? null, set: (k, v) => store.set(k, String(v)), keys: () => [...store.keys()], remove: (k) => store.delete(k) },
  sleep: (ms) => new Promise((r) => setTimeout(r, Math.min(ms, 15))),
  log: (...a) => logs.push(a.join(" ")),
  error: (code, message, opts = {}) => Object.assign(new Error(message), { code, ...opts }),
};
const plugin = await import("../src/plugin.js");

beforeEach(() => { calls.length = 0; pages = {}; logs = []; store = new Map(); lang = "es"; cfg = {}; });

const BASE = "https://www.cablevisionhd.org";
// A channel card as the home page writes it: `<a class="channel" href=".../<slug>.php">` with the title in `<div class="channel-name">`.
const card = (slug, title, img = "imge/x.webp") => `<a class="channel" href="${BASE}/${slug}.php" data-category="Deportes" aria-label="${title} en vivo"> <div class="live-badge"><i></i>EN VIVO</div> <div class="channel-number">00</div> <div class="channel-logo"><div class="logo-glow"></div><img src="${img}" alt="${title}" loading="lazy"></div> <div class="channel-name">${title}</div> <div class="play" aria-hidden="true"></div> </a>`;
const GRID = `<html><body>
<a class="channel" href="${BASE}/redes/" target="_blank"> <div class="channel-logo"><img src="imge/tvenvivo.webp"></div> <div class="channel-name">Mundo Latam</div> </a>
${card("tudn-en-vivo", "TUDN", "imge/tudn.webp")}
${card("espn-2-en-vivo", "ESPN 2")}
${card("telefe-en-vivo", "TELEFE")}
${card("cartoon-network-en-vivo", "CARTOON NETWORK")}
${card("tudn-en-vivo", "TUDN repeated")}
${card("universal-channel-en-vivo", "UNIVERSAL CHANNEL")}
</body></html>`;

// A channel page names its up-to-three signals in a `const SOURCES = {...}` script object (option 1 is live/, 2 is live2/, 3 is live3/).
const channelPage = (canal, n = 3) => `<div class="server-buttons"><button>Opción 1</button></div>
<script>
const SOURCES={
${Array.from({ length: n }, (_, i) => `  ${i + 1}:"${BASE}/live${i ? i + 1 : ""}/core.php?canal=${canal}"`).join(",\n")}
};
</script>
<iframe class="chat-embed" src="${BASE}/chat.php"></iframe>`;
const corePage = (host, canal, target) => `<html><iframe id="player-frame" src="https://${host}/stream.php?canal=${canal}&amp;target=${target}&amp;sig=abc123" allowfullscreen></iframe></html>`;
const playerPage = (host, n) => `<script>aclib.runPop({ zoneId: '1' });</script><script>var src = "https:\\/\\/${host}\\/playlist\\/${n}\\/index.m3u8?token=tok-${n}"; var video = document.getElementById("video");</script>`;

const install = () => {
  pages[BASE + "/"] = { body: GRID };
};
const installChannel = (slug, canal, host, opts = 3) => {
  pages[`${BASE}/${slug}.php`] = { body: channelPage(canal, opts) };
  for (let i = 1; i <= opts; i++) {
    const core = `${BASE}/live${i > 1 ? i : ""}/core.php?canal=${canal}`;
    pages[core] = { body: corePage(host, canal, i) };
    pages[`https://${host}/stream.php?canal=${canal}&target=${i}&sig=abc123`] = { body: playerPage(host, i) };
    pages[`https://${host}/playlist/${i}/index.m3u8?token=tok-${i}`] = { body: "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1\ntracks/mono.m3u8" };
  }
};

test("the manifest declares the new-UI capabilities (channels, resolve, screen), the screen block, v0.5.0 and the player hosts", () => {
  const text = readFileSync(new URL("../kino-plugin.json", import.meta.url), "utf8");
  const m = JSON.parse(text);
  const v = validateManifest(text);
  assert.ok(!v.errors?.length && v.ok !== false, JSON.stringify(v));
  for (const cap of ["channels", "resolve", "search", "screen"]) assert.ok(m.capabilities.includes(cap), cap);
  for (const gone of ["home", "browse", "scopedSearch"]) assert.ok(!m.capabilities.includes(gone), "dropped: " + gone);
  assert.ok(m.screen && m.screen.menuOpens === "screen" && m.screen.settingsIn === "screen");
  assert.ok(m.apiVersion >= 19, "apiVersion >= 19 (mergeWithKinoBar floor), was " + m.apiVersion);
  assert.equal(m.version, "0.5.0");
  assert.equal(m.liveStreamHosts, "any");
  for (const h of ["www.cablevisionhd.org", "cablevisionhd.org", "deportes.ksdjugfssddeports.com", "regionales.saohgdassregions.com"]) assert.ok(m.hosts.includes(h), h);
});

test("liveCategories: everything first, then the seven groups with their genre", async () => {
  const c = await plugin.liveCategories();
  assert.deepEqual(c.map((x) => x.id), ["all", "sports", "entertainment", "news", "movies", "kids", "education", "always"]);
  assert.equal(c.find((x) => x.id === "sports").genre, "deportes");
  lang = "en";
  assert.equal((await plugin.liveCategories())[0].title, "All");
});

test("liveChannels: only channel pages, each once, with an absolute logo; a non-channel card is skipped", async () => {
  install();
  const { items } = await plugin.liveChannels({ categoryId: "all" });
  assert.deepEqual(items.map((i) => i.id), ["tudn-en-vivo", "espn-2-en-vivo", "telefe-en-vivo", "cartoon-network-en-vivo", "universal-channel-en-vivo"]);
  assert.equal(items[0].logo, BASE + "/imge/tudn.webp");
  assert.equal(items[0].ref, "tudn-en-vivo");
  assert.ok(!items.some((i) => /mundo latam/i.test(i.title)));
});

test("liveChannels: a group keeps only the channels whose name belongs to it", async () => {
  install();
  assert.deepEqual((await plugin.liveChannels({ categoryId: "sports" })).items.map((i) => i.id), ["tudn-en-vivo", "espn-2-en-vivo"]);
  assert.deepEqual((await plugin.liveChannels({ categoryId: "kids" })).items.map((i) => i.id), ["cartoon-network-en-vivo"]);
  assert.deepEqual((await plugin.liveChannels({ categoryId: "movies" })).items.map((i) => i.id), ["universal-channel-en-vivo"]);
});

test("the grid is fetched once and kept for a while", async () => {
  install();
  await plugin.liveChannels({ categoryId: "all" });
  await plugin.liveChannels({ categoryId: "sports" });
  assert.equal(calls.filter((c) => c.url === BASE + "/").length, 1);
});

test("a home page with no channel cards is an error with a message for the person, not an empty list", async () => {
  pages[BASE + "/"] = { body: "<html>landing page</html>" };
  await assert.rejects(plugin.liveChannels({ categoryId: "all" }), (e) => e.code === "unavailable" && /lista de canales/.test(e.userMessage));
});

test("liveSearch: accent-blind, needs two letters", async () => {
  install();
  assert.deepEqual((await plugin.liveSearch({ query: "e" })).items, []);
  assert.deepEqual((await plugin.liveSearch({ query: "ESPN" })).items.map((i) => i.id), ["espn-2-en-vivo"]);
  assert.deepEqual((await plugin.liveSearch({ query: "télefe" })).items.map((i) => i.id), ["telefe-en-vivo"]);
});

test("search (global): live items by name, accent-blind, needs two letters", async () => {
  install();
  assert.deepEqual(await plugin.search("e"), []);
  const r = await plugin.search("télefe");
  assert.deepEqual(r.map((i) => i.id), ["telefe-en-vivo"]);
  assert.equal(r[0].kind, "live");
  assert.equal(r[0].ref, "telefe-en-vivo");
});

test("resolve: follows page -> option -> player and returns the playlist, with the other options as alternatives", async () => {
  installChannel("tudn-en-vivo", "tudn", "deportes.ksdjugfssddeports.com");
  const s = await plugin.resolve("tudn-en-vivo");
  assert.equal(s.url, "https://deportes.ksdjugfssddeports.com/playlist/1/index.m3u8?token=tok-1");
  assert.equal(s.mime, "application/x-mpegURL");
  assert.equal(s.headers.Referer, "https://deportes.ksdjugfssddeports.com/");
  assert.match(s.headers["User-Agent"], /Firefox/);
  assert.deepEqual(s.alternatives, [{ ref: "tudn-en-vivo|2", label: "Opción 2" }, { ref: "tudn-en-vivo|3", label: "Opción 3" }]);
  assert.ok(calls.every((c) => c.opts.headers["User-Agent"]), "every request carries the browser User-Agent");
});

test("resolve: an alternative asks only its own option", async () => {
  installChannel("telefe-en-vivo", "telefe", "regionales.saohgdassregions.com");
  const s = await plugin.resolve("telefe-en-vivo|3");
  assert.equal(s.url, "https://regionales.saohgdassregions.com/playlist/3/index.m3u8?token=tok-3");
  assert.equal(s.alternatives, undefined);
  assert.ok(!calls.some((c) => /\/live2?\/core\.php/.test(c.url)));
});

test("resolve: a dead first option falls through to the next one", async () => {
  installChannel("espn-2-en-vivo", "espn-2", "deportes.ksdjugfssddeports.com");
  pages["https://deportes.ksdjugfssddeports.com/stream.php?canal=espn-2&target=1&sig=abc123"] = { body: "<html>no player</html>" };
  const s = await plugin.resolve("espn-2-en-vivo");
  assert.match(s.url, /playlist\/2\//);
  assert.equal(s.label, "Opción 2");
  assert.deepEqual(s.alternatives.map((a) => a.ref), ["espn-2-en-vivo|1", "espn-2-en-vivo|3"]);
});

test("resolve: no playable option gives not_found with a sentence for the person; a bad ref too", async () => {
  installChannel("tudn-en-vivo", "tudn", "deportes.ksdjugfssddeports.com", 2);
  for (const i of [1, 2]) pages[`https://deportes.ksdjugfssddeports.com/stream.php?canal=tudn&target=${i}&sig=abc123`] = { status: 502, body: "" };
  await assert.rejects(plugin.resolve("tudn-en-vivo"), (e) => e.code === "not_found" && /no está disponible/.test(e.userMessage));
  await assert.rejects(plugin.resolve("../etc/passwd"), (e) => e.code === "not_found");
  await assert.rejects(plugin.resolve("tudn-en-vivo|0"), (e) => e.code === "not_found");
});

test("resolve: a channel page that is gone (404) is reported, not swallowed", async () => {
  await assert.rejects(plugin.resolve("warner-channel-en-vivo"), (e) => e.code === "unavailable");
});

test("resolve: the playerbackURL form (base64) is read too", async () => {
  installChannel("telefe-en-vivo", "telefe", "regionales.saohgdassregions.com", 1);
  const url = "https://regionales.saohgdassregions.com/playlist/9/index.m3u8?token=zz";
  pages["https://regionales.saohgdassregions.com/stream.php?canal=telefe&target=1&sig=abc123"] = { body: `<script>var playbackURL = atob("${Buffer.from(url).toString("base64")}");</script>` };
  pages[url] = { body: "#EXTM3U\n" };
  assert.equal((await plugin.resolve("telefe-en-vivo")).url, url);
});

test("resolve: an option whose playlist answers 404 (the channel is off air there) is skipped for the next one", async () => {
  installChannel("fox-deportes-en-vivo", "fox-deportes", "deportes.ksdjugfssddeports.com");
  delete pages["https://deportes.ksdjugfssddeports.com/playlist/1/index.m3u8?token=tok-1"];
  pages["https://deportes.ksdjugfssddeports.com/playlist/2/index.m3u8?token=tok-2"] = { body: "<html>not a playlist</html>" };
  const s = await plugin.resolve("fox-deportes-en-vivo");
  assert.match(s.url, /playlist\/3\//);
  assert.equal(s.label, "Opción 3");
  assert.deepEqual(s.alternatives.map((a) => a.ref), ["fox-deportes-en-vivo|1", "fox-deportes-en-vivo|2"]);
});

test("resolve: when every option is off air the person gets the sentence, not a dead address", async () => {
  installChannel("fox-deportes-en-vivo", "fox-deportes", "deportes.ksdjugfssddeports.com", 2);
  for (const i of [1, 2]) delete pages[`https://deportes.ksdjugfssddeports.com/playlist/${i}/index.m3u8?token=tok-${i}`];
  await assert.rejects(plugin.resolve("fox-deportes-en-vivo"), (e) => e.code === "not_found" && /no está disponible/.test(e.userMessage));
});

// ---- Home rows, section, categories, search and settings ----

const GRID2 = `<html><body>${[["tudn-en-vivo", "TUDN"], ["espn-en-vivo", "ESPN"], ["espn-2-en-vivo", "ESPN 2"], ["fox-sports-en-vivo", "FOX SPORTS"], ["telefe-en-vivo", "TELEFE"], ["caracol-en-vivo", "CARACOL"], ["cartoon-network-en-vivo", "CARTOON NETWORK"], ["discovery-channel-en-vivo", "DISCOVERY CHANNEL"]].map(([slug, name]) => card(slug, name, `imge/${slug}.webp`)).join("")}</body></html>`;
const installGrid = () => { pages[BASE + "/"] = { body: GRID2 }; };

test("settings: the preferred option is tried first and the others follow; checking the signal can be switched off", async () => {
  installChannel("tudn-en-vivo", "tudn", "deportes.ksdjugfssddeports.com");
  cfg.option = "2";
  const s = await plugin.resolve("tudn-en-vivo");
  assert.match(s.url, /playlist\/2\//);
  assert.equal(s.label, "Opción 2");
  assert.deepEqual(s.alternatives.map((a) => a.ref), ["tudn-en-vivo|1", "tudn-en-vivo|3"]);
  calls.length = 0;
  cfg.option = "auto"; cfg.verify = false;
  delete pages["https://deportes.ksdjugfssddeports.com/playlist/1/index.m3u8?token=tok-1"];
  const s2 = await plugin.resolve("tudn-en-vivo");
  assert.match(s2.url, /playlist\/1\//, "with the check off a playlist address is handed over without looking at it");
  assert.ok(!calls.some((c) => c.url.includes("/index.m3u8")));
});

test("settings: the status line counts the channels of the grid, says so when the grid is out, and the actions clear or refresh it", async () => {
  installGrid();
  assert.match((await plugin.settingsStatus()).info, /8 canales/);
  lang = "en";
  assert.match((await plugin.settingsStatus()).info, /8 channels/);
  lang = "es";
  assert.equal((await plugin.action("clearCache")).message, "Caché vaciada.");
  assert.equal(store.size, 0);
  assert.match((await plugin.action("check")).message, /Comprobado: 8 canales/);
  pages = {}; store = new Map();
  assert.match((await plugin.settingsStatus()).info, /No se pudo abrir la parrilla/);
});

test("the grid: a server error is retried once, and a site that stays down shows the list kept before", async () => {
  install();
  let n = 0;
  const real = kino.fetch;
  kino.fetch = async (url, opts) => { if (url === BASE + "/") { n++; return n === 1 ? { ok: false, status: 503, text: () => "" } : real(url, opts); } return real(url, opts); };
  const first = (await plugin.liveChannels({})).items;
  assert.ok(first.length > 0);
  assert.equal(n, 2, "one retry after the 503");
  // the site goes away and the fresh copy is old: the kept list answers
  const e = JSON.parse(store.get("channels")); e.at = Date.now() - 60 * 60 * 1000; store.set("channels", JSON.stringify(e));
  kino.fetch = async () => { throw Object.assign(new Error("net"), { code: "network" }); };
  const again = (await plugin.liveChannels({})).items;
  assert.equal(again.length, first.length);
  assert.ok(logs.some((l) => l.includes("kept before")));
  kino.fetch = real;
});

test("the grid: a site that stays down and nothing kept is an error", async () => {
  const real = kino.fetch;
  kino.fetch = async () => { throw Object.assign(new Error("net"), { code: "network" }); };
  await assert.rejects(() => plugin.liveChannels({}));
  kino.fetch = real;
});

test("resolve: a slow first option does not hold up a good second one", async () => {
  installChannel("lento-en-vivo", "lento", "p.example.test", 2);
  const real = kino.fetch;
  kino.fetch = async (url, opts) => { if (url === `${BASE}/live/core.php?canal=lento`) await new Promise((r) => setTimeout(r, 400)); return real(url, opts); };
  const t0 = Date.now();
  const stream = await plugin.resolve("lento-en-vivo");
  assert.ok(stream.url.includes("/playlist/2/"), stream.url);
  assert.ok(Date.now() - t0 < 300, "did not wait for the slow option");
  kino.fetch = real;
});
