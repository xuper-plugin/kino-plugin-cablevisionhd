# CablevisionHD → UI nueva (screen + Scaffold) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar el plugin CablevisionHD de la API de datos vieja a la UI nueva del framework (pantalla propia `screen()`/`screenEvent()` que devuelve un `Scaffold`), reestructurado en `src/` con build esbuild, sobre el kit SDK apiVersion 30, sin cambiar la resolución de streams.

**Architecture:** El código pasa de un único `plugin.js` escrito a mano a módulos en `src/` que esbuild empaqueta en el `plugin.js` final (bundle, commiteado). `src/site.js` = toda la lógica del sitio (scraping, caché, categorías, `resolve`); `src/i18n.js` = textos es/en + `twin`; `src/ui.js` = la pantalla (vistas `Scaffold`, `screen`/`screenEvent`); `src/plugin.js` = entry que cablea los exports públicos. Los canales siguen alimentando la pestaña global "En vivo" de Kino vía `channels`.

**Tech Stack:** JavaScript ESM, esbuild (bundle), `node --test` (tests), kit SDK de Kino (`sdk/validate.mjs`, `sdk/run.mjs`).

**Spec:** `docs/superpowers/specs/2026-11-26-cablevisionhd-nueva-ui-design.md`

## Global Constraints

- Kit SDK empacado = **apiVersion 30**, fuente **`C:\dev\kino-app\plugins\sdk\`** (es el kit .mjs canónico a `maxApiVersion: 30`, con `screen.mjs`/`ui-tables.mjs`/`slot.mjs`).
- `apiVersion` del manifest = el **mínimo que valide** con los widgets usados (empezar en **20**, como cinemitas; subir solo si `validate.mjs` lo exige).
- `version` del plugin = **0.5.0**.
- **No tocar** la lógica de scraping/caché ni `resolve`/`firstOpening`/`streamFromOption`: la reproducción de deportes (`deportes.*`) y regionales (`regionales.*`) debe seguir igual.
- Conservar los exports `liveCategories`/`liveChannels`/`liveSearch` (+ capability `channels`) → pestaña global "En vivo".
- Tarjeta de canal = `{ id, ref, title, kind:"live", poster: logo, onTap:{ go:{ play:{ ref, kind:"live", id, title } } } }`, con `ref` = slug `*-en-vivo` (lo mismo que ya consume `resolve`).
- Pestañas **dinámicas** (una por grupo con canales, vía `usedGroups`); "Todos" = rejilla plana de todos; nunca pestañas vacías.
- Commits/push **solo como xuper-plugin** (`user.name=xuper-plugin`, `user.email=335105665+xuper-plugin@users.noreply.github.com`). Sin línea de coautoría.
- Build: `esbuild src/plugin.js --bundle --format=esm --target=es2020 --outfile=plugin.js`.

## Review Focus

- **Contrato 30 más estricto sobre código intacto:** el kit 30 podría marcar los exports `resolve`/`liveChannels` no tocados. → Task 1 valida el plugin actual contra el kit 30 **antes** de reestructurar y para si marca algo.
- **Grupo sin canales hoy:** una pestaña por grupo vacío no debe aparecer (p. ej. "Noticias"/"24/7" si el sitio no trae ninguno). → Task 3: test de que `tabsOf` sale de `usedGroups`.
- **El sitio no responde al abrir la pantalla:** `allChannels()` falla y no hay lista guardada. → Task 3: test de que `screen()` devuelve un `Scaffold` con banner de error + reintento, no un throw.
- **`ref` de la tarjeta roto:** si el `onTap.go.play.ref` no es el slug exacto, la reproducción muere. → Task 3: test de que la tarjeta lleva `ref` === `id` del canal (`*-en-vivo`).
- **Pérdida de la pestaña global "En vivo":** si al quitar los surfaces viejos se cae `channels`/`liveChannels`. → Task 4: el test del manifest exige `channels` en capabilities y conserva los exports `liveChannels`/`liveCategories`/`liveSearch`.

---

### Task 1: Empacar el kit SDK apiVersion 30 y validar lo intacto (salvaguarda)

**Files:**
- Modify (reemplazar): `sdk/*` (todos los `.mjs` del kit)
- Sin cambios aún en `plugin.js`/`kino-plugin.json`

**Interfaces:**
- Consumes: el kit canónico en `C:\dev\kino-app\plugins\sdk\`.
- Produces: un `sdk/` a `maxApiVersion: 30` que `validate.mjs` corre sobre el plugin actual.

- [ ] **Step 1: Copiar el kit 30 sobre `sdk/`**

Copiar todos los `.mjs` de `C:\dev\kino-app\plugins\sdk\` a `C:\dev\kino-plugin-cablevisionhd\sdk\` (sobrescribe `contract.mjs`, `validate.mjs`, `run.mjs`, `kino-shim.mjs`, `guide-tables.mjs`, `init.mjs`, `kino-rank.mjs`, `live-playlist.mjs`, `palette.mjs`, `panel.mjs`, `seal.mjs`, y añade los nuevos: `screen.mjs`, `ui-tables.mjs`, `slot.mjs`, `shared.mjs`, `protocol.mjs`, `sandbox.mjs`, `kit-call.mjs`, `notices.mjs`, `appthemes.mjs`, `coins.mjs`, `job.mjs`, `visual-browser.mjs`). Conservar `sdk/test/` existente.

- [ ] **Step 2: Confirmar la versión del kit**

Run: `grep -oE '"maxApiVersion"[^0-9]*[0-9]+' sdk/contract.mjs | head -1`
Expected: muestra `30`.

- [ ] **Step 3: Salvaguarda — validar el plugin ACTUAL (sin tocar) contra el kit 30**

Run: `node sdk/validate.mjs . --repo xuper-plugin/kino-plugin-cablevisionhd`
Expected: `✓ Kino would accept this plugin` (los exports `resolve`/`liveChannels`/`liveCategories`/`liveSearch`/`home`/`section`/… siguen válidos). **Si marca algún error sobre código no tocado → PARAR y reportar** (no cambiarlo a ciegas; es una decisión del diseño).

- [ ] **Step 4: Tests actuales en verde**

Run: `node --test test/*.test.mjs`
Expected: PASS (26 tests).

- [ ] **Step 5: Commit**

```bash
git add sdk/
git commit -m "cablevisionhd: empaca el kit SDK apiVersion 30 (base para la UI nueva)"
```

---

### Task 2: Pipeline de build + mover la lógica a `src/` (sin cambiar comportamiento)

**Files:**
- Create: `src/plugin.js`, `src/site.js`, `src/i18n.js`
- Modify: `package.json` (scripts + devDep esbuild), `plugin.js` (pasa a ser el bundle generado), `test/plugin.test.mjs` (import)
- Test: `test/plugin.test.mjs` (los 26 existentes, sin cambios de aserción)

**Interfaces:**
- Produces (desde `src/site.js`, re-exportados por `src/plugin.js`): **exactamente la misma API pública que hoy** — `liveCategories()`, `liveChannels({categoryId})`, `liveSearch({query})`, `home()`, `browse(ref)`, `search(arg)`, `section({tab})`, `categories()`, `settingsStatus()`, `action(key)`, `resolve(ref)`, más helpers `fold`, `CATEGORIES`, `categoriesOf`, `inGroup`, `usedGroups`, `GROUP`, `allChannels`.
- Produces (desde `src/i18n.js`): `t(key, vars?)`, `twin(key, prop?, vars?)`, `TEXTS`.

- [ ] **Step 1: Mover textos a `src/i18n.js`**

Extraer el objeto `TEXTS` y la función `t()` del `plugin.js` actual a `src/i18n.js`; añadir `twin(key, prop = "label", vars)` → `{ [prop]: t_es, [prop+"En"]: t_en }` (lee ambos idiomas de `TEXTS`). Export: `TEXTS`, `t`, `twin`.

- [ ] **Step 2: Mover la lógica a `src/site.js`**

Mover de `plugin.js` a `src/site.js` todo lo no-UI: constantes (`BASE`, `UA`, `HLS_MIME`, `CACHE_*`, `STALE_MS`, `RESOLVE_MS`, `HEDGE_MS`, `MAX_OPTIONS`), `fold`, `decode`, `CATEGORIES`, `categoriesOf`, `parseChannels`, `fetchText`, `readChannels`, `allChannels`, `setting`, `toChannel`, `parseOptions`, `parseIframe`, `parsePlaylist`, `streamFromOption`, `firstOpening`, `resolve`, los exports de live (`liveCategories`/`liveChannels`/`liveSearch`), los de la UI vieja (`home`/`browse`/`search`/`section`/`categories` + `liveItem`/`inGroup`/`usedGroups`/`GROUP`/`rowOf`), y `settingsStatus`/`action`. Importa `t`/`twin` de `./i18n.js`. **Sin cambios de lógica.**

- [ ] **Step 3: Crear el entry `src/plugin.js`**

`src/plugin.js` pone `globalThis.__kinoDropPendingFetches = true;` y re-exporta todo lo público desde `./site.js` (mismos nombres que hoy). Nada más.

- [ ] **Step 4: package.json — build + validate + esbuild**

Añadir a `scripts`: `"build": "esbuild src/plugin.js --bundle --format=esm --target=es2020 --outfile=plugin.js"` y cambiar `"validate"` a `"npm run build && node sdk/validate.mjs . --repo xuper-plugin/kino-plugin-cablevisionhd"`. Añadir `"devDependencies": { "esbuild": "^0.21.0" }`. Dejar `"test": "node --test test/*.test.mjs"`.

- [ ] **Step 5: Instalar esbuild y generar el bundle**

Run: `npm install && npm run build`
Expected: crea/actualiza `plugin.js` en la raíz (el bundle) sin errores.

- [ ] **Step 6: Apuntar los tests al source**

En `test/plugin.test.mjs` cambiar el import `await import("../plugin.js")` → `await import("../src/plugin.js")` (los tests prueban el source; el bundle lo valida `npm run validate`).

- [ ] **Step 7: Tests + validate en verde**

Run: `node --test test/*.test.mjs` → PASS (26).
Run: `npm run validate` → `✓ Kino would accept this plugin`.

- [ ] **Step 8: Commit**

```bash
git add src/ package.json package-lock.json plugin.js test/plugin.test.mjs
git commit -m "cablevisionhd: reestructura a src/ + build esbuild (comportamiento idéntico)"
```

---

### Task 3: Construir la pantalla propia (`screen`/`screenEvent`) en `src/ui.js`

**Files:**
- Create: `src/ui.js`, `test/screen.test.mjs`
- Modify: `src/i18n.js` (textos de la pantalla), `src/plugin.js` (exporta `screen`/`screenEvent`)

**Interfaces:**
- Consumes de `./site.js`: `allChannels`, `CATEGORIES`, `categoriesOf`, `usedGroups`, `inGroup`, `GROUP`, `settingsStatus`, `action`, `t`, `twin`.
- Produces (en `src/ui.js`, re-exportados por `src/plugin.js`):
  - `channelCard(c) -> { id, ref, title, kind:"live", poster?, onTap }` con `ref === c.id` y `onTap = { go: { play: { ref: c.id, kind:"live", id: c.id, title: c.title } } }`.
  - `tabsOf(list) -> [{id:"all", label}, ...{id, label} por cada usedGroups]`.
  - `channelsInTab(list, tab) -> Channel[]` (`tab==="all"` ⇒ todos).
  - `mainView({ list, tab, device }) -> Scaffold`.
  - `searchView({ list, query, device }) -> Scaffold`.
  - `settingsView({ info, device }) -> Scaffold`.
  - `async screen(ctx) -> widget`; `async screenEvent(ev) -> { state } | null`.

- [ ] **Step 1: Test — `channelCard` lleva el `ref`/`onTap` correctos**

```js
// test/screen.test.mjs
test("channelCard: ref = id del canal y onTap reproduce ese ref", () => {
  const card = ui.channelCard({ id: "tudn-en-vivo", title: "TUDN", logo: "https://x/imge/tudn.webp" });
  assert.equal(card.ref, "tudn-en-vivo");
  assert.equal(card.kind, "live");
  assert.equal(card.poster, "https://x/imge/tudn.webp");
  assert.deepEqual(card.onTap, { go: { play: { ref: "tudn-en-vivo", kind: "live", id: "tudn-en-vivo", title: "TUDN" } } });
});
```

- [ ] **Step 2: Test — pestañas dinámicas y rejilla plana**

```js
test("mainView: pestañas solo de grupos con canales; la pestaña activa muestra una rejilla plana", async () => {
  const list = await loadChannels(GRID_FIXTURE);           // helper del test (stub de kino + fixture del sitio .org)
  const v = ui.mainView({ list, tab: "all", device: "phone" });
  assert.equal(v.type, "Scaffold");
  const tabIds = findTabs(v).map((x) => x.id);             // helper que recorre el árbol
  assert.equal(tabIds[0], "all");
  assert.ok(tabIds.includes("sports"));
  assert.ok(!tabIds.includes("news") || hasNews(list));    // sin pestaña de grupo vacío
  const grid = findByType(v, "titleGrid");
  assert.ok(grid && grid.items.length === list.length);    // "all" = rejilla plana de todos
});
```

- [ ] **Step 3: Test — `screen()` ante el sitio caído devuelve Scaffold con error, no throw**

```js
test("screen: si allChannels falla y no hay caché, devuelve un Scaffold con banner de error + reintento", async () => {
  failNetwork();                                           // stub: kino.fetch lanza
  const v = await plugin.screen({ route: { name: "main" }, state: {}, device: "phone" });
  assert.equal(v.type, "Scaffold");
  assert.ok(JSON.stringify(v).includes("MaterialBanner"));
});
```

- [ ] **Step 4: Test — `screenEvent` cambia de pestaña y ejecuta acciones**

```js
test("screenEvent: 'tab' fija el grupo; 'clearCache' llama a action y limpia", async () => {
  const r = await plugin.screenEvent({ name: "tab", value: "sports", state: { tab: "all" } });
  assert.equal(r.state.tab, "sports");
  seedCache();
  const r2 = await plugin.screenEvent({ name: "clearCache", state: {} });
  assert.ok(r2 && (r2.message || r2.state));              // reusa action("clearCache")
});
```

- [ ] **Step 5: Verificar que fallan**

Run: `node --test test/screen.test.mjs`
Expected: FAIL (`ui`/`plugin.screen` no definidos aún).

- [ ] **Step 6: Implementar `src/ui.js`**

Implementar las funciones del bloque Interfaces siguiendo el molde de xtream (`liveView`/`settingsView`/`roundChannel`): `mainView` = `Scaffold` con `appBar` (título + acciones buscar/ajustes) y `body` con una barra de pestañas (`tabsOf`) + rejilla (`titleGrid` columns `{compact:3, expanded:6}` en phone/desktop; `Row` de canales redondos en `device==="tv"`); `settingsView` = `Scaffold` con `{type:"settings", keys:["option","verify"], autoSave:true, onSaved:"saved"}` + botones que llaman `action("check")`/`action("clearCache")` + línea de estado de `settingsStatus()`; `screen(ctx)` enruta por `ctx.route?.name` (`main`/`search`/`settings`), hace `await allChannels()` dentro de `try/catch` (catch ⇒ vista con `MaterialBanner`), y pasa `ctx.device`; `screenEvent(ev)` despacha por `ev.name` (`tab`,`q`,`retry`,`check`,`clearCache`,`saved`) devolviendo `{state}` o reusando `action()`. Textos nuevos (título, "buscar", "ajustes", vacío, error) a `src/i18n.js`. Decisión del asistente: `screen()` **espera** `allChannels()` (cacheado 10 min / stale 7 días) en vez de skeleton+poll — más simple y con latencia aceptable.

- [ ] **Step 7: Exportar desde `src/plugin.js`**

Añadir `export { screen, screenEvent } from "./ui.js";` (los exports viejos siguen por ahora).

- [ ] **Step 8: Verde**

Run: `node --test test/*.test.mjs` → PASS (26 + nuevos).
Run: `npm run build` → bundle OK.

- [ ] **Step 9: Commit**

```bash
git add src/ui.js src/i18n.js src/plugin.js test/screen.test.mjs plugin.js
git commit -m "cablevisionhd: pantalla propia (screen/screenEvent) con pestañas + rejilla"
```

---

### Task 4: Cambiar el manifest a la UI nueva y quitar los surfaces viejos

**Files:**
- Modify: `kino-plugin.json`, `src/plugin.js`, `src/site.js`, `test/plugin.test.mjs`

**Interfaces:**
- Produces: manifest con `capabilities: ["channels","resolve","screen"]`, bloque `screen`, `settings` recortado, `apiVersion` nueva, `version: "0.5.0"`. `src/plugin.js` deja de exportar `home`/`browse`/`search`/`section`/`categories`.

- [ ] **Step 1: Test — manifest de UI nueva**

Actualizar el test del manifest en `test/plugin.test.mjs`: `capabilities` incluye `["channels","resolve","screen"]` y **no** incluye `home`/`browse`/`search`/`scopedSearch`; `m.screen` existe con `menuOpens:"screen"` y `settingsIn:"screen"`; `m.hosts` incluye `www.cablevisionhd.org`; `m.version === "0.5.0"`; se conservan los tests de `resolve`/`liveChannels`/`liveSearch`. Quitar los tests de `home`/`section`/`categories`/`browse`.

- [ ] **Step 2: Verificar que falla**

Run: `node --test test/plugin.test.mjs` → FAIL (manifest aún viejo).

- [ ] **Step 3: Editar `kino-plugin.json`**

`capabilities: ["channels","resolve","screen"]`; añadir `"screen": { "label":"CablevisionHD","labelEn":"CablevisionHD","icon":"live_tv","menuOpens":"screen","opensFrom":["menu","settings"],"settingsIn":"screen","settingsButton":{"label":"Abrir CablevisionHD","labelEn":"Open CablevisionHD"} }`; recortar `settings` a `signalSection`+`option`+`verify` (quitar `info`/`check`/`clearCache`); `apiVersion: 20` (subir solo si `validate.mjs` lo exige); `version: "0.5.0"`; quitar `section` si el validador lo pide al haber `screen`.

- [ ] **Step 4: Quitar los exports de UI vieja**

En `src/plugin.js` dejar de re-exportar `home`/`browse`/`search`/`section`/`categories`; borrar esas funciones (y `rowOf`/`liveItem` si quedan sin uso) de `src/site.js`. Conservar `liveCategories`/`liveChannels`/`liveSearch`, `settingsStatus`, `action`, `resolve`, `screen`, `screenEvent`.

- [ ] **Step 5: Verde (tests + validate + build)**

Run: `node --test test/*.test.mjs` → PASS.
Run: `npm run validate` → `✓ Kino would accept this plugin`. (Si pide `apiVersion` mayor, subirla al número exacto que indique y re-correr.)

- [ ] **Step 6: Commit**

```bash
git add kino-plugin.json src/plugin.js src/site.js test/plugin.test.mjs plugin.js
git commit -m "cablevisionhd 0.5.0: manifest a la UI nueva (screen), quita los surfaces viejos"
```

---

### Task 5: CHANGELOG, smoke en vivo y publicación

**Files:**
- Modify: `CHANGELOG.md`, `README.md` (si aplica)

**Interfaces:** —

- [ ] **Step 1: CHANGELOG 0.5.0**

Añadir entrada `## 0.5.0` (es/en): pantalla propia con la UI nueva (pestañas por grupo + rejilla), ajustes dentro de la pantalla, SDK a apiVersion 30; la reproducción (deportes/regionales) no cambia.

- [ ] **Step 2: Build + validate + tests finales**

Run: `npm run build && npm run validate && node --test test/*.test.mjs`
Expected: todo verde.

- [ ] **Step 3: Smoke en vivo (resolve sigue intacto)**

Run: `node sdk/run.mjs ./plugin.js resolve tudn-en-vivo` y `node sdk/run.mjs ./plugin.js resolve telefe-en-vivo`
Expected: cada uno devuelve un `.m3u8` (deportes y regionales respectivamente). (Si `run.mjs` no expone `resolve` directo para `channels`, usar el harness de `live.mjs`/`hosts2.mjs` del scratchpad como alternativa.)

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md README.md
git commit -m "cablevisionhd 0.5.0: changelog y notas de la UI nueva"
```

- [ ] **Step 5: Push como xuper-plugin**

Run: `git push origin HEAD`
Expected: sube a `xuper-plugin/kino-plugin-cablevisionhd` (tras tu visto bueno del diff).
