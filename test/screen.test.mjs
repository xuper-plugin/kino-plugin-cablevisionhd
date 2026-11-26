// node --test test/screen.test.mjs
// The plugin's own screen (screen/screenEvent) and its view builders, with a stub of `kino`.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkScreenTree } from "../sdk/screen.mjs";

const MANIFEST = JSON.parse(readFileSync(new URL("../kino-plugin.json", import.meta.url), "utf8"));
// The real apiVersion-30 validator: which nodes/props Kino would drop from this tree. Empty = the tree renders as built.
const drops = (tree) => checkScreenTree(tree, "es", undefined, { apiVersion: MANIFEST.apiVersion, settings: MANIFEST.settings }).dropped;

let lang = "es";
let cfg = {};
let store = new Map();
let throwFetch = false;
globalThis.kino = {
  get lang() { return lang; },
  config: { get: (k) => cfg[k] },
  storage: { get: (k) => store.get(k) ?? null, set: (k, v) => store.set(k, String(v)), keys: () => [...store.keys()], remove: (k) => store.delete(k) },
  sleep: (ms) => new Promise((r) => setTimeout(r, Math.min(ms, 15))),
  log: () => {},
  error: (code, message, opts = {}) => Object.assign(new Error(message), { code, ...opts }),
  fetch: async () => { if (throwFetch) throw Object.assign(new Error("net"), { code: "network" }); return { ok: false, status: 404, text: () => "" }; },
};
const ui = await import("../src/ui.js");

beforeEach(() => { lang = "es"; cfg = {}; store = new Map(); throwFetch = false; });

// Recursively find the first node whose `type` matches.
function findByType(node, type) {
  if (!node || typeof node !== "object") return null;
  if (node.type === type) return node;
  for (const v of Object.values(node)) {
    if (Array.isArray(v)) { for (const c of v) { const hit = findByType(c, type); if (hit) return hit; } }
    else if (v && typeof v === "object") { const hit = findByType(v, type); if (hit) return hit; }
  }
  return null;
}

const LIST = [
  { id: "tudn-en-vivo", title: "TUDN", logo: "https://x/imge/tudn.webp" },
  { id: "espn-en-vivo", title: "ESPN" },
  { id: "telefe-en-vivo", title: "TELEFE" },
  { id: "cartoon-network-en-vivo", title: "CARTOON NETWORK" },
];

test("channelCard: a titleGrid item with ref=id and kind live (the grid plays it on tap)", () => {
  const card = ui.channelCard({ id: "tudn-en-vivo", title: "TUDN", logo: "https://x/imge/tudn.webp" });
  assert.equal(card.ref, "tudn-en-vivo");
  assert.equal(card.id, "tudn-en-vivo");
  assert.equal(card.kind, "live");
  assert.equal(card.poster, "https://x/imge/tudn.webp");
});

test("roundChannel (TV): tapping plays that channel's ref", () => {
  const w = ui.roundChannel({ id: "tudn-en-vivo", title: "TUDN", logo: "https://x/imge/tudn.webp" });
  assert.deepEqual(w.onTap, { go: { play: { ref: "tudn-en-vivo", kind: "live", id: "tudn-en-vivo", title: "TUDN" } } });
});

test("mainView: tabs only for groups with channels; the active tab shows a flat grid of all", () => {
  const v = ui.mainView({ list: LIST, tab: "all", device: "phone" });
  assert.equal(v.type, "Scaffold");
  const tabBar = findByType(v, "TabBar");
  const tabIds = tabBar.tabs.map((t) => t.value);
  assert.equal(tabIds[0], "all");
  assert.ok(tabIds.includes("sports") && tabIds.includes("entertainment") && tabIds.includes("kids"));
  assert.ok(!tabIds.includes("news") && !tabIds.includes("movies") && !tabIds.includes("education"));
  const grid = findByType(v, "titleGrid");
  assert.equal(grid.items.length, LIST.length);
});

test("mainView: a group tab shows only that group's channels", () => {
  const v = ui.mainView({ list: LIST, tab: "sports", device: "phone" });
  const grid = findByType(v, "titleGrid");
  assert.deepEqual(grid.items.map((i) => i.id), ["tudn-en-vivo", "espn-en-vivo"]);
});

test("screen: when the site is down and nothing is cached, returns a Scaffold with an error banner, not a throw", async () => {
  throwFetch = true;
  const v = await ui.screen({ route: { name: "main" }, state: {}, device: "phone" });
  assert.equal(v.type, "Scaffold");
  assert.ok(findByType(v, "MaterialBanner"), "has an error banner");
});

test("screenEvent: 'tab' fixes the active group", async () => {
  const r = await ui.screenEvent({ name: "tab", value: "sports", state: { tab: "all" } });
  assert.equal(r.state.tab, "sports");
});

test("screenEvent: 'clearCache' clears the saved list via action()", async () => {
  store.set("channels", JSON.stringify({ at: Date.now(), v: [{ id: "x-en-vivo", title: "X" }] }));
  const r = await ui.screenEvent({ name: "clearCache", state: {} });
  assert.equal(store.has("channels"), false);
  assert.ok(r && (r.toast || r.message || r.state));
});

test("screenEvent: 'go' navigates to the search/settings routes and back to main", async () => {
  assert.deepEqual((await ui.screenEvent({ name: "go", arg: "search" })).route, { push: "search" });
  assert.deepEqual((await ui.screenEvent({ name: "go", arg: "settings" })).route, { push: "settings" });
  assert.deepEqual((await ui.screenEvent({ name: "go", arg: "main" })).route, { pop: true });
});

test("the real validator drops nothing from the main/search/settings/error trees (even with 65 channels)", async () => {
  const list = Array.from({ length: 65 }, (_, i) => ({ id: `tudn-${i}-en-vivo`, title: `TUDN ${i}`, logo: "https://x/t.webp" }));
  assert.deepEqual(drops(ui.mainView({ list, tab: "all", device: "phone" })), [], "main");
  assert.deepEqual(drops(ui.searchView({ list, query: "tudn", device: "phone" })), [], "search");
  assert.deepEqual(drops(ui.settingsView({ info: "20 canales", device: "phone" })), [], "settings");
  throwFetch = true;
  assert.deepEqual(drops(await ui.screen({ route: { name: "main" }, state: {}, device: "phone" })), [], "error");
});

test("mainView: the flat grid is capped and shows an overflow hint when a tab has more than the cap", () => {
  const list = Array.from({ length: 65 }, (_, i) => ({ id: `tudn-${i}-en-vivo`, title: `TUDN ${i}` }));
  const v = ui.mainView({ list, tab: "all", device: "phone" });
  const grid = findByType(v, "titleGrid");
  assert.ok(grid.items.length <= 60, "grid capped at 60, was " + grid.items.length);
  const hint = JSON.stringify(v);
  assert.ok(/65|primeros|first/i.test(hint), "shows an overflow hint");
});
