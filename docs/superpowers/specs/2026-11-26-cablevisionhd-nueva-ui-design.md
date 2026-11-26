# CablevisionHD — migración a la UI nueva (screen + Scaffold)

Fecha: 2026-11-26
Repo: `xuper-plugin/kino-plugin-cablevisionhd`

## Intención y por qué

cablevisionhd es de los últimos plugins (con cinehdplus, deportv) que sigue pintando
su UI propia con la **API de datos vieja** (`home`/`section`/`categories`/`browse`).
Todos los demás (cinemitas, latanime, xtream, megaplay, news, verpelis…) ya usan la
**UI nueva del framework**: una pantalla propia declarativa, `screen()`/`screenEvent()`
que devuelven un árbol `Scaffold`. El objetivo es ponerlo al día — darle una pantalla
propia consistente con el resto, sobre el **SDK más reciente (apiVersion 30)**, sin tocar
la resolución de streams que acabamos de arreglar para el sitio `.org`.

## Goals

- **Pantalla propia** (capability `screen`): AppBar (título, buscar, ajustes) + **pestañas por
  grupo** (Todos, Deportes, Entretenimiento, Noticias, Películas, Infantil, Educación) + **rejilla
  de logos**; tap en un canal → reproduce con el `resolve` actual.
- **Adaptativo**: teléfono/desktop = rejilla (`titleGrid`) + FAB de búsqueda; TV = canales redondos
  con foco D-pad + pestañas en la barra (como xtream).
- **Ajustes dentro de la pantalla** (`settingsIn: "screen"`): widget `settings` embebido con las keys
  actuales (opción preferida, comprobar señal) + botones de acción (actualizar parrilla, vaciar caché)
  + línea de estado (nº de canales).
- **Búsqueda** dentro de la pantalla (por nombre, como hoy).
- **SDK empacado actualizado a apiVersion 30.**
- Los canales **siguen apareciendo en la pestaña global "En vivo" de Kino** (se conserva la capability
  `channels` y los exports `liveChannels`/`liveCategories`/`liveSearch`).

## Non-goals

- No cambiar `resolve` ni la lógica de scraping/caché del sitio.
- No cambiar la agrupación por categorías (se mantiene `categoriesOf` por nombre; pasar a `data-category`
  queda fuera de este trabajo).
- No tocar otros plugins ni el SDK canónico.

## Anti-goals (fracaso aunque "funcione")

- Que la migración rompa la reproducción de **deportes** (`deportes.*`) o **regionales** (`regionales.*`).
- Que los canales dejen de salir en la pestaña global **"En vivo"**.
- Una pantalla que en **TV no sea navegable con control remoto**.

## Constraints

- `apiVersion` del manifest = el **mínimo que valide** con los widgets usados (cinemitas usa 20; manda el
  validador `sdk/validate.mjs`).
- Commits y push **solo como xuper-plugin** (regla del repo).
- El SDK empacado (`sdk/`) debe **sincronizarse al kit apiVersion 30**, fuente: el **kit canónico
  `~/Documents/kino-plugin-sdk`** (`maxApiVersion: 30`). Decisión del usuario: usar "la última" (30), aun sabiendo
  que **ningún plugin publicado está en 30** (los más nuevos —xtream, latanime— van en 21); este plugin quedará con
  el kit más nuevo de todos. **Salvaguarda obligatoria:** como el contrato 30 es más estricto que el de la era-9
  contra el que se escribieron los exports actuales, antes de dar por hecho el Non-goal "no tocar resolve/channels"
  hay que correr `validate.mjs` del kit 30 sobre los exports intactos (`resolve`/`liveChannels`/`liveCategories`/`liveSearch`)
  y, si marca algo, reportarlo (no cambiarlo a ciegas).

## Approaches considerados

**Forma de la pantalla** (decidida con el usuario):
- **A. Pestañas + rejilla — ELEGIDA.** Barra + fila de pestañas por grupo + **rejilla plana de logos** (no rieles),
  tal cual el mockup aprobado. Inmediato y va bien con D-pad en TV. (Nota: aunque el texto hablaba de "parecido al
  `section` de hoy", el mockup aprobado manda: rejilla plana por pestaña, no los rieles agrupados del `section` viejo.)
  - **Pestañas dinámicas:** una por grupo que tenga canales hoy (reutiliza `usedGroups`), nunca pestañas vacías; el
    grupo "24/7" aparece solo si trae canales. La pestaña **"Todos"** es la rejilla plana de los ~70 canales.
- B. Dropdown + rejilla (el `liveView` de xtream). Más limpio con muchas categorías, pero añade un toque
  para cambiar de grupo; cablevisionhd solo tiene ~6 grupos → las pestañas ganan.
- C. Portada hero + rieles (el `mainView` de xtream). Pensado para catálogos grandes de películas; demasiado
  para 70 canales de TV en vivo y con más scroll.

**Capabilities** (decisión del asistente, abierta a corrección):
- **Conservar `channels` + `resolve`** (los canales siguen en la pestaña global "En vivo") y **añadir `screen`**,
  **eliminando** los surfaces viejos de sección propia (`home`/`browse`/`search`/`scopedSearch` y el export
  `section`/`categories`). Alternativa descartada: *screen-only* (perdería la integración con la pestaña global
  y empeora el descubrimiento). Modelo de manifest: **cinemitas** (single-door, `screen` en las capabilities de
  nivel superior); modelo de implementación de TV en vivo: **xtream** (`liveView` + `settingsView`).

## El cómo (decidido)

### Manifest (`kino-plugin.json`)
- `apiVersion`: subir (~20, el mínimo que valide).
- `version`: **0.5.0**.
- `capabilities`: `["channels", "resolve", "screen"]` (quita `home`/`browse`/`search`/`scopedSearch`).
- Añadir bloque **`screen`**:
  `{ label: "CablevisionHD", labelEn: "CablevisionHD", icon: "live_tv", menuOpens: "screen",
  opensFrom: ["menu","settings"], settingsIn: "screen",
  settingsButton: { label: "Abrir CablevisionHD", labelEn: "Open CablevisionHD" } }`.
- **Recortar `settings`** a lo que de verdad usa el widget embebido: `signalSection` (cabecera) + `option` + `verify`.
  **Quitar** las filas nativas `info` (status), `check` y `clearCache`: con `settingsIn:"screen"` esas quedarían
  huérfanas/duplicadas, porque la vista de ajustes de la pantalla ya muestra el estado (`settingsStatus()`) y los
  botones "Actualizar parrilla"/"Vaciar caché" (que llaman a `action()`). Se **conservan** los exports
  `settingsStatus`/`action`. Mantener `theme`, `hosts`, `telemetry`. Quitar/ajustar `section` según lo que exija el
  validador cuando hay `screen` (builder decide).

### `plugin.js`
- **Intacto**: constantes del sitio, `fetchText`/`parseChannels`/`parseOptions`/`parseIframe`/`parsePlaylist`,
  caché (`allChannels`/`readChannels`), `resolve`, `firstOpening`, `streamFromOption`, `__kinoDropPendingFetches`,
  y los exports `liveCategories`/`liveChannels`/`liveSearch` (pestaña global) + `settingsStatus`/`action`
  (reutilizados por la pantalla de ajustes).
- **Quitar** los exports de la UI vieja: `home`, `browse`, `search`, `section`, `categories`.
- **Añadir**:
  - `twin()`/tabla de textos es/en para la pantalla.
  - Vistas `Scaffold`: `mainView` (pestañas + rejilla), `settingsView`; búsqueda integrada en `mainView`
    (campo + resultados) o `searchView` aparte.
  - `screen(ctx)`: enruta por `ctx.route.name` (`main`/`settings`), lee `ctx.state` y `ctx.device`, pide los
    canales (`allChannels()`), muestra skeleton + `every:{ ms, event:"tick" }` mientras cargan, y devuelve el
    Scaffold; `try/catch` con fallback al form de settings (como xtream).
  - `screenEvent(ev)`: maneja `tab` (cambiar grupo), `q`/buscar, `retry`, acciones `check`/`clearCache` (reusan
    `action()`), `saved`. Devuelve `{ state }` o `null`.
  - **Tarjeta de canal**: `{ id, ref, title, kind:"live", poster: logo,
    onTap: { go: { play: { ref, kind:"live", id, title } } } }`. Rejilla `titleGrid`
    (`columns:{compact:3, expanded:6}`) en phone/desktop; `Row` de `roundChannel` (wrap, gap) en TV.
  - `export { ..., screen, screenEvent }`.

### Modelo de estado
- `state = { tab, q, n, failed }` (se incrementa `n` para forzar re-render). Los canales salen de
  `allChannels()` (ya cacheado 10 min / stale 7 días). Mientras carga → skeleton + poll `tick`.

### Ajustes
- `settingsIn: "screen"` → la vista de ajustes usa `{ type:"settings", keys:["option","verify"], autoSave:true,
  onSaved:"saved" }` + botones que llaman a `action("check")`/`action("clearCache")` + línea de estado de
  `settingsStatus()`.

### Tests (`test/plugin.test.mjs`)
- Quitar los tests de `home`/`section`/`categories`/`browse`.
- Añadir tests de `screen()` (devuelve `Scaffold`; pestañas por grupo con canales; una tarjeta lleva
  `onTap.go.play.ref` correcto y `kind:"live"`; vista de ajustes) y de `screenEvent()` (`tab` cambia grupo;
  `q` filtra; `retry`; acciones reusan `action`).
- Mantener los tests de `resolve`/`liveChannels`/`liveSearch`/manifest (ajustando capabilities esperadas).
- `sdk/validate.mjs` debe pasar y `node --test` en verde.

## Lo que queda al builder

- El número exacto de `apiVersion` del manifest (el más bajo que valide con los widgets usados; cinemitas usa 20).
- La ruta/mecánica exacta de copiar el kit canónico (`~/Documents/kino-plugin-sdk`, 30) al `sdk/` empacado
  (los layouts difieren: el repo canónico tiene `contract.json`; el `sdk/` empacado tiene `contract.mjs`/`validate.mjs`/
  `kino-shim.mjs`… — el builder resuelve la forma correcta de sincronizar).
- Si `section` se mantiene junto a `screen` o se quita (según exija el contrato/validador).
- Detalles finos del layout responsivo (columnas compact/expanded, tamaños) y los textos es/en.
