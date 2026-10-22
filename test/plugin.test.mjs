// node --test test/plugin.test.mjs
// Offline: a fake cablevisionhd.com (grid page, channel pages, option pages, players) and a stub of `kino`.
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
  log: (...a) => logs.push(a.join(" ")),
  error: (code, message, opts = {}) => Object.assign(new Error(message), { code, ...opts }),
};
const plugin = await import("../plugin.js");

beforeEach(() => { calls.length = 0; pages = {}; logs = []; store = new Map(); lang = "es"; cfg = {}; });

const BASE = "https://www.cablevisionhd.com";
const card = (slug, title, img = "imge/x.webp") => `<a href="${BASE}/${slug}.php" class="channel-card"> <div class="live"><span class="live-dot"></span>EN VIVO</div> <img src="${img}" alt="${title}"> <p>${title}</p> </a>`;
const GRID = `<html><body>
<a href="${BASE}/redes/" target="_blank" class="channel-card"> <img src="imge/tvenvivo.webp"> <p>Mundo Latam 🌐</p> </a>
${card("tudn-ver", "TUDN", "imge/tudn.webp")}
${card("espn-2-ver", "ESPN 2")}
${card("telefe-ver", "TELEFE")}
${card("cartoon-network-ver", "CARTOON NETWORK")}
${card("tudn-ver", "TUDN repeated")}
${card("universal-channel-ver", "UNIVERSAL CHANNEL")}
</body></html>`;

const channelPage = (canal, n = 3) => `<div class="options">${Array.from({ length: n }, (_, i) => `<a class="option${i ? "" : " active"}" href="${BASE}/stream${i ? i + 1 : ""}/core.php?canal=${canal}" target="player">Opción ${i + 1}</a>`).join("")}</div>
<iframe name="player" src="${BASE}/stream/core.php?canal=${canal}" allowfullscreen></iframe><iframe src="${BASE}/chat.php"></iframe>`;
const corePage = (host, canal, target) => `<html><iframe src="https://${host}/stream.php?canal=${canal}&amp;target=${target}&amp;sig=abc123" allowfullscreen></iframe></html>`;
const playerPage = (host, n) => `<script>aclib.runPop({ zoneId: '1' });</script><script>var src = "https:\\/\\/${host}\\/playlist\\/${n}\\/index.m3u8?token=tok-${n}"; var video = document.getElementById("video");</script>`;

const install = () => {
  pages[BASE + "/parrilla-directo.php"] = { body: GRID };
};
const installChannel = (slug, canal, host, opts = 3) => {
  pages[`${BASE}/${slug}.php`] = { body: channelPage(canal, opts) };
  for (let i = 1; i <= opts; i++) {
    const core = `${BASE}/stream${i > 1 ? i : ""}/core.php?canal=${canal}`;
    pages[core] = { body: corePage(host, canal, i) };
    pages[`https://${host}/stream.php?canal=${canal}&target=${i}&sig=abc123`] = { body: playerPage(host, i) };
    pages[`https://${host}/playlist/${i}/index.m3u8?token=tok-${i}`] = { body: "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1\ntracks/mono.m3u8" };
  }
};

test("the manifest passes the kit's contract check and declares the channel and player hosts", () => {
  const text = readFileSync(new URL("../kino-plugin.json", import.meta.url), "utf8");
  const m = JSON.parse(text);
  const v = validateManifest(text);
  assert.ok(!v.errors?.length && v.ok !== false, JSON.stringify(v));
  assert.ok(m.capabilities.includes("channels") && m.liveStreamHosts === "any");
  for (const h of ["www.cablevisionhd.com", "cablevisionhd.com", "deportes.ksdjugfssddeports.com", "regionales.saohgdassregions.com"]) assert.ok(m.hosts.includes(h), h);
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
  assert.deepEqual(items.map((i) => i.id), ["tudn-ver", "espn-2-ver", "telefe-ver", "cartoon-network-ver", "universal-channel-ver"]);
  assert.equal(items[0].logo, BASE + "/imge/tudn.webp");
  assert.equal(items[0].ref, "tudn-ver");
  assert.ok(!items.some((i) => /mundo latam/i.test(i.title)));
});

test("liveChannels: a group keeps only the channels whose name belongs to it", async () => {
  install();
  assert.deepEqual((await plugin.liveChannels({ categoryId: "sports" })).items.map((i) => i.id), ["tudn-ver", "espn-2-ver"]);
  assert.deepEqual((await plugin.liveChannels({ categoryId: "kids" })).items.map((i) => i.id), ["cartoon-network-ver"]);
  assert.deepEqual((await plugin.liveChannels({ categoryId: "movies" })).items.map((i) => i.id), ["universal-channel-ver"]);
});

test("the grid is fetched once and kept for a while", async () => {
  install();
  await plugin.liveChannels({ categoryId: "all" });
  await plugin.liveChannels({ categoryId: "sports" });
  assert.equal(calls.filter((c) => c.url.endsWith("/parrilla-directo.php")).length, 1);
});

test("a grid page with no channel cards is an error with a message for the person, not an empty list", async () => {
  pages[BASE + "/parrilla-directo.php"] = { body: "<html>landing page</html>" };
  await assert.rejects(plugin.liveChannels({ categoryId: "all" }), (e) => e.code === "unavailable" && /lista de canales/.test(e.userMessage));
});

test("liveSearch: accent-blind, needs two letters", async () => {
  install();
  assert.deepEqual((await plugin.liveSearch({ query: "e" })).items, []);
  assert.deepEqual((await plugin.liveSearch({ query: "ESPN" })).items.map((i) => i.id), ["espn-2-ver"]);
  assert.deepEqual((await plugin.liveSearch({ query: "télefe" })).items.map((i) => i.id), ["telefe-ver"]);
});

test("resolve: follows page -> option -> player and returns the playlist, with the other options as alternatives", async () => {
  installChannel("tudn-ver", "tudn", "deportes.ksdjugfssddeports.com");
  const s = await plugin.resolve("tudn-ver");
  assert.equal(s.url, "https://deportes.ksdjugfssddeports.com/playlist/1/index.m3u8?token=tok-1");
  assert.equal(s.mime, "application/x-mpegURL");
  assert.equal(s.headers.Referer, "https://deportes.ksdjugfssddeports.com/");
  assert.match(s.headers["User-Agent"], /Firefox/);
  assert.deepEqual(s.alternatives, [{ ref: "tudn-ver|2", label: "Opción 2" }, { ref: "tudn-ver|3", label: "Opción 3" }]);
  assert.ok(calls.every((c) => c.opts.headers["User-Agent"]), "every request carries the browser User-Agent");
});

test("resolve: an alternative asks only its own option", async () => {
  installChannel("telefe-ver", "telefe", "regionales.saohgdassregions.com");
  const s = await plugin.resolve("telefe-ver|3");
  assert.equal(s.url, "https://regionales.saohgdassregions.com/playlist/3/index.m3u8?token=tok-3");
  assert.equal(s.alternatives, undefined);
  assert.ok(!calls.some((c) => /stream2?\/core\.php/.test(c.url) && !/stream3/.test(c.url)));
});

test("resolve: a dead first option falls through to the next one", async () => {
  installChannel("espn-2-ver", "espn-2", "deportes.ksdjugfssddeports.com");
  pages["https://deportes.ksdjugfssddeports.com/stream.php?canal=espn-2&target=1&sig=abc123"] = { body: "<html>no player</html>" };
  const s = await plugin.resolve("espn-2-ver");
  assert.match(s.url, /playlist\/2\//);
  assert.equal(s.label, "Opción 2");
  assert.deepEqual(s.alternatives.map((a) => a.ref), ["espn-2-ver|1", "espn-2-ver|3"]);
});

test("resolve: no playable option gives not_found with a sentence for the person; a bad ref too", async () => {
  installChannel("tudn-ver", "tudn", "deportes.ksdjugfssddeports.com", 2);
  for (const i of [1, 2]) pages[`https://deportes.ksdjugfssddeports.com/stream.php?canal=tudn&target=${i}&sig=abc123`] = { status: 502, body: "" };
  await assert.rejects(plugin.resolve("tudn-ver"), (e) => e.code === "not_found" && /no está disponible/.test(e.userMessage));
  await assert.rejects(plugin.resolve("../etc/passwd"), (e) => e.code === "not_found");
  await assert.rejects(plugin.resolve("tudn-ver|0"), (e) => e.code === "not_found");
});

test("resolve: a channel page that is gone (404) is reported, not swallowed", async () => {
  await assert.rejects(plugin.resolve("warner-channel-ver"), (e) => e.code === "unavailable");
});

test("resolve: the playerbackURL form (base64) is read too", async () => {
  installChannel("telefe-ver", "telefe", "regionales.saohgdassregions.com", 1);
  const url = "https://regionales.saohgdassregions.com/playlist/9/index.m3u8?token=zz";
  pages["https://regionales.saohgdassregions.com/stream.php?canal=telefe&target=1&sig=abc123"] = { body: `<script>var playbackURL = atob("${Buffer.from(url).toString("base64")}");</script>` };
  pages[url] = { body: "#EXTM3U\n" };
  assert.equal((await plugin.resolve("telefe-ver")).url, url);
});

test("resolve: an option whose playlist answers 404 (the channel is off air there) is skipped for the next one", async () => {
  installChannel("fox-deportes-ver", "fox-deportes", "deportes.ksdjugfssddeports.com");
  delete pages["https://deportes.ksdjugfssddeports.com/playlist/1/index.m3u8?token=tok-1"];
  pages["https://deportes.ksdjugfssddeports.com/playlist/2/index.m3u8?token=tok-2"] = { body: "<html>not a playlist</html>" };
  const s = await plugin.resolve("fox-deportes-ver");
  assert.match(s.url, /playlist\/3\//);
  assert.equal(s.label, "Opción 3");
  assert.deepEqual(s.alternatives.map((a) => a.ref), ["fox-deportes-ver|1", "fox-deportes-ver|2"]);
});

test("resolve: when every option is off air the person gets the sentence, not a dead address", async () => {
  installChannel("fox-deportes-ver", "fox-deportes", "deportes.ksdjugfssddeports.com", 2);
  for (const i of [1, 2]) delete pages[`https://deportes.ksdjugfssddeports.com/playlist/${i}/index.m3u8?token=tok-${i}`];
  await assert.rejects(plugin.resolve("fox-deportes-ver"), (e) => e.code === "not_found" && /no está disponible/.test(e.userMessage));
});

// ---- Home rows, section, categories, search and settings ----

const GRID2 = `<html><body>${[["tudn-ver", "TUDN"], ["espn-ver", "ESPN"], ["espn-2-ver", "ESPN 2"], ["fox-sports-ver", "FOX SPORTS"], ["telefe-ver", "TELEFE"], ["caracol-ver", "CARACOL"], ["cartoon-network-ver", "CARTOON NETWORK"], ["discovery-channel-ver", "DISCOVERY CHANNEL"]].map(([slug, name]) => card(slug, name, `imge/${slug}.webp`)).join("")}</body></html>`;
const installGrid = () => { pages[BASE + "/parrilla-directo.php"] = { body: GRID2 }; };

test("home: a row per group that has channels, each channel a live item with its logo and a Ver más to its group", async () => {
  installGrid();
  const rows = await plugin.home();
  assert.deepEqual(rows.map((r) => r.id), ["sports", "entertainment", "kids", "education"]);
  assert.deepEqual(rows[0].items.map((i) => i.title), ["TUDN", "ESPN", "ESPN 2", "FOX SPORTS"]);
  assert.equal(rows[0].items[0].kind, "live");
  assert.equal(rows[0].items[0].ref, "tudn-ver");
  assert.equal(rows[0].items[0].poster, BASE + "/imge/tudn-ver.webp");
  assert.match(rows[0].items[0].id, /^[A-Za-z0-9._~-]{1,128}$/);
  assert.equal(rows[0].ref, "cat:sports");
  assert.equal(rows[0].genre, "deportes");
  assert.equal(rows[0].title, "Deportes");
});

test("browse: a group's channels in full; anything else is empty", async () => {
  installGrid();
  assert.deepEqual((await plugin.browse("cat:kids")).items.map((i) => i.title), ["CARTOON NETWORK"]);
  assert.deepEqual((await plugin.browse("cat:nope")).items, []);
  assert.deepEqual((await plugin.browse("zz")).items, []);
});

test("section: tabs only for groups with channels, the first tab shows every row, a tab shows its group, an unknown tab is the first, the hero is the first channel with its logo", async () => {
  installGrid();
  const all = await plugin.section({ tab: null });
  assert.deepEqual(all.tabs.map((x) => x.id), ["todos", "sports", "entertainment", "kids", "education"], "no tab for news, movies or 24/7: none has a channel today");
  assert.equal(all.tab, "todos");
  assert.deepEqual(all.rows.map((r) => r.id), ["sports", "entertainment", "kids", "education"]);
  assert.equal(all.hero.title, "TUDN");
  assert.equal(all.hero.image, BASE + "/imge/tudn-ver.webp");
  assert.match(all.hero.text, /Canales de TV en vivo/);
  const sports = await plugin.section({ tab: "sports" });
  assert.deepEqual(sports.rows.map((r) => r.id), ["sports"]);
  assert.equal((await plugin.section({ tab: "nope" })).tab, "todos");
  assert.equal((await plugin.section({ tab: "always" })).tab, "todos", "a group with nothing in it is not a tab");
});

test("categories: only the groups with channels, with a channel's logo as the tile's art", async () => {
  installGrid();
  const c = await plugin.categories();
  assert.deepEqual(c.map((x) => x.ref), ["cat:sports", "cat:entertainment", "cat:kids", "cat:education"]);
  assert.equal(c[0].title, "Deportes");
  assert.equal(c[0].art, BASE + "/imge/tudn-ver.webp");
  assert.ok(c.every((x) => /^g-[a-z0-9]+$/.test(x.id)));
});

test("search: channels by name, accent-blind; inside a group only that group's; an unknown page answers null so Kino filters it", async () => {
  installGrid();
  assert.deepEqual((await plugin.search("espn")).map((i) => i.title), ["ESPN", "ESPN 2"]);
  assert.deepEqual(await plugin.search("e"), []);
  assert.deepEqual((await plugin.search({ q: "discovery" })).map((i) => i.kind), ["live"]);
  assert.deepEqual((await plugin.search({ q: "s", within: "cat:sports" })), []);
  assert.deepEqual((await plugin.search({ q: "fox", within: "cat:sports" })).map((i) => i.title), ["FOX SPORTS"]);
  assert.deepEqual((await plugin.search({ q: "telefe", within: "cat:sports" })), []);
  assert.equal(await plugin.search({ q: "telefe", within: "cat:nope" }), null);
  const m = JSON.parse(readFileSync(new URL("../kino-plugin.json", import.meta.url), "utf8"));
  assert.ok(["search", "scopedSearch", "browse", "channels"].every((c) => m.capabilities.includes(c)));
});

test("settings: the preferred option is tried first and the others follow; checking the signal can be switched off", async () => {
  installChannel("tudn-ver", "tudn", "deportes.ksdjugfssddeports.com");
  cfg.option = "2";
  const s = await plugin.resolve("tudn-ver");
  assert.match(s.url, /playlist\/2\//);
  assert.equal(s.label, "Opción 2");
  assert.deepEqual(s.alternatives.map((a) => a.ref), ["tudn-ver|1", "tudn-ver|3"]);
  calls.length = 0;
  cfg.option = "auto"; cfg.verify = false;
  delete pages["https://deportes.ksdjugfssddeports.com/playlist/1/index.m3u8?token=tok-1"];
  const s2 = await plugin.resolve("tudn-ver");
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
