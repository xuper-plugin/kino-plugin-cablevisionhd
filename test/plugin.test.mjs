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
globalThis.kino = {
  get lang() { return lang; },
  config: { get: () => undefined },
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

beforeEach(() => { calls.length = 0; pages = {}; logs = []; store = new Map(); lang = "es"; });

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
