// CablevisionHD -- the plugin's own screen (apiVersion 14+): tabs per group + a flat grid of channel logos.
// screen(ctx) returns a Scaffold widget tree; screenEvent(ev) updates its state. Tapping a channel plays it through resolve().
import { t, twin } from "./i18n.js";
import { allChannels, usedGroups, inGroup, GROUP, fold, settingsStatus, action } from "./site.js";

const ROUTES = ["main", "search", "settings"];
const GRID_CAP = 120;

// ---- pieces -----------------------------------------------------------------------------------------------------

/** A titleGrid item for one channel; the grid plays it on tap because `kind` is "live". */
export function channelCard(c) {
  const out = { id: c.id, ref: c.id, title: c.title, kind: "live" };
  if (c.logo) out.poster = c.logo;
  return out;
}

/** A round channel tile for TV (D-pad focus); tapping plays the channel. */
export function roundChannel(c) {
  return {
    type: "Column",
    key: "ch-" + c.id,
    w: 120,
    gap: 8,
    crossAxisAlignment: "center",
    onTap: { go: { play: { ref: c.id, kind: "live", id: c.id, title: c.title } } },
    children: [
      { type: "CircleAvatar", key: "chl-" + c.id, radius: 44, ...(c.logo ? { image: c.logo } : { text: String(c.title).slice(0, 2).toUpperCase() }), labelText: c.title, labelTextEn: c.title },
      { type: "Text", text: c.title, textEn: c.title, style: "caption", maxLines: 1, textAlign: "center" },
    ],
  };
}

/** The tabs for the current channel list: "Todos" first, then one per group that has a channel. */
export function tabsOf(list) {
  return [{ id: "all", ...twin("all") }, ...usedGroups(list).map((g) => ({ id: g.id, ...twin(g.key) }))];
}

/** The channels of a tab ("all" = every channel). */
export function channelsInTab(list, tab) {
  return !tab || tab === "all" ? list : inGroup(list, tab);
}

const brand = () => ({ type: "Text", key: "brand", text: t("title"), textEn: "CablevisionHD", style: "h4" });
const barBtn = (key, icon, labelKey, onPressed) => ({ type: "IconButton", key, icon, ...twin(labelKey, "labelText"), ...twin(labelKey, "tooltip"), onPressed });
const tabBar = (active, tabs) => ({ type: "TabBar", key: "tabs", divider: false, value: active, onChanged: "tab", tabs: tabs.map((x) => ({ value: x.id, label: x.label, labelEn: x.labelEn })) });
const scroll = (key, children) => ({ type: "SingleChildScrollView", key, children: [{ type: "Column", padding: { compact: 12, expanded: 24 }, gap: 16, children }] });
const backBar = (titleKey) => ({ type: "AppBar", mergeWithKinoBar: true, dense: true, divider: false, leading: barBtn("back", "arrow_back", "back", { event: "go", arg: "main" }), ...twin(titleKey, "title") });

// ---- views ------------------------------------------------------------------------------------------------------

export function mainView({ list, tab, device }) {
  const tv = device === "tv";
  const tabs = tabsOf(list);
  const active = tabs.some((x) => x.id === tab) ? tab : "all";
  const channels = channelsInTab(list, active);
  const body = channels.length === 0
    ? { type: "Text", ...twin("empty", "text"), color: "muted" }
    : tv
      ? { type: "Row", key: "channels", wrap: true, gap: 24, children: channels.slice(0, GRID_CAP).map(roundChannel) }
      : { type: "titleGrid", key: "grid-" + active, columns: { compact: 3, expanded: 6 }, items: channels.slice(0, GRID_CAP).map(channelCard) };
  return {
    type: "Scaffold",
    appBar: {
      type: "AppBar",
      mergeWithKinoBar: true,
      dense: true,
      divider: false,
      title: brand(),
      actions: [barBtn("searchBtn", "search", "search", { event: "go", arg: "search" }), barBtn("settingsBtn", "settings", "settings", { event: "go", arg: "settings" })],
    },
    body: {
      type: "Column",
      key: "page",
      children: [
        { type: "Column", key: "tabsRow", padding: { compact: 0, expanded: 24 }, children: [tabBar(active, tabs)] },
        { type: "SingleChildScrollView", key: "browse-" + active, flex: 1, children: [{ type: "Column", padding: { compact: 12, expanded: 24 }, gap: 16, children: [body] }] },
      ],
    },
  };
}

export function searchView({ list, query, device }) {
  const q = fold(query || "");
  const results = q.length >= 2 ? list.filter((c) => fold(c.title).includes(q)).slice(0, GRID_CAP) : [];
  const tv = device === "tv";
  const body = [
    {
      type: "Form",
      key: "searchForm",
      onSubmitted: "q",
      gap: 8,
      children: [{ type: "TextField", key: "q", kind: "text", value: query || "", ...twin("searchHint", "labelText"), maxLength: 80, autofocus: true, onSubmitted: "q" }],
    },
  ];
  if (q.length >= 2) {
    if (results.length === 0) body.push({ type: "Text", ...twin("noResults", "text"), color: "muted" });
    else if (tv) body.push({ type: "Row", key: "results", wrap: true, gap: 24, children: results.map(roundChannel) });
    else body.push({ type: "titleGrid", key: "results", columns: { compact: 3, expanded: 6 }, items: results.map(channelCard) });
  }
  return { type: "Scaffold", appBar: backBar("search"), body: scroll("search-page", body) };
}

export function settingsView({ info, device }) {
  return {
    type: "Scaffold",
    appBar: backBar("settings"),
    body: scroll("settings-page", [
      { type: "Card", key: "signalCard", children: [
        { type: "Text", ...twin("signalTitle", "text"), style: "h4" },
        { type: "settings", key: "signalForm", keys: ["option", "verify"], autoSave: true, onSaved: "saved" },
      ] },
      { type: "Card", key: "gridCard", children: [
        { type: "Row", key: "gridButtons", wrap: true, gap: 8, children: [
          { type: "ElevatedButton", key: "refresh", ...twin("refresh", "labelText"), icon: "refresh", onPressed: "check" },
          { type: "Button", variant: "secondary", key: "clear", ...twin("clear", "labelText"), icon: "delete", onPressed: "clearCache" },
        ] },
        { type: "Text", text: info || "", textEn: info || "", style: "caption", color: "muted" },
      ] },
    ]),
  };
}

function errorView() {
  return {
    type: "Scaffold",
    appBar: { type: "AppBar", mergeWithKinoBar: true, dense: true, divider: false, title: brand() },
    body: scroll("error-page", [
      { type: "MaterialBanner", key: "loadFailed", role: "error", ...twin("siteDown"), action: { ...twin("retry", "label"), onTap: "retry" } },
    ]),
  };
}

// ---- screen + events --------------------------------------------------------------------------------------------

export async function screen(ctx) {
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

const bump = (state) => ({ n: (state.n || 0) + 1 });
const pickStr = (value, arg) => (typeof value === "string" ? value : typeof arg === "string" ? arg : "");
const events = {
  tab({ value, arg, state }) { return { state: { ...state, tab: pickStr(value, arg) || "all", ...bump(state) } }; },
  q({ value, arg, state }) { return { state: { ...state, q: pickStr(value, arg), ...bump(state) } }; },
  retry({ state }) { return { state: { ...state, ...bump(state) } }; },
  async check({ state }) { const r = await action("check"); return { toast: { text: r.message }, state: { ...state, ...bump(state) } }; },
  async clearCache({ state }) { const r = await action("clearCache"); return { toast: { text: r.message }, state: { ...state, ...bump(state) } }; },
  saved({ state }) { return { state: { ...state, ...bump(state) } }; },
};

export async function screenEvent(ev) {
  const e = ev && typeof ev === "object" ? ev : {};
  const handler = Object.hasOwn(events, e.name) ? events[e.name] : null;
  if (!handler) return null;
  try {
    return await handler({ ...e, state: e.state && typeof e.state === "object" ? e.state : {} }) ?? null;
  } catch (_) {
    return { toast: { text: t("siteDown"), role: "error" } };
  }
}
