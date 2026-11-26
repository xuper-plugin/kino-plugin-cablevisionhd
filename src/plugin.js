// Kino plugin: CablevisionHD -- live TV channels from www.cablevisionhd.org. Entry point: wires the public exports.
// Kino waits for every request a call left running before it delivers the call's answer (quickjs-kt joins the pending async work);
// asking Kino to drop what a call leaves running (Kino 0.9.55 and later read this flag; an older one ignores it) lets the answer
// leave at the call's own budget instead of being held for a slow row's request.
globalThis.__kinoDropPendingFetches = true;

export {
  liveCategories,
  liveChannels,
  liveSearch,
  home,
  browse,
  search,
  section,
  categories,
  settingsStatus,
  action,
  resolve,
} from "./site.js";
