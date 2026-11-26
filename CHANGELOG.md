# Changelog

## 0.5.0

- Pantalla propia con la UI nueva del framework: `screen()`/`screenEvent()` que devuelven un `Scaffold` con una barra de pestañas por grupo (Todos, Deportes, Entretenimiento, Noticias, Películas, Infantil, Educación — solo los que tienen canales) y una rejilla de logos; al tocar un canal se reproduce con el mismo `resolve`. Adaptativo: teléfono/escritorio con rejilla, TV con canales redondos y foco D-pad. Los ajustes (opción de señal, comprobar la señal, actualizar la parrilla, vaciar la caché) viven dentro de la pantalla, y hay búsqueda por nombre. El código se reorganizó en `src/` y un build con esbuild produce `plugin.js`. El SDK empacado sube a apiVersion 30 y el manifest declara `screen` (apiVersion 14, necesita Kino 0.9.74 o posterior). La reproducción (deportes y regionales) no cambia, y los canales siguen apareciendo en la pestaña global "En vivo".
  / New framework UI: the plugin now has its own screen (`screen()`/`screenEvent()` → `Scaffold`) with a tab bar per group and a grid of channel logos; tapping a channel plays it through the same `resolve`. Adaptive for phone/desktop (grid) and TV (round channels, D-pad focus). Settings live inside the screen, plus search by name. The code moved to `src/` with an esbuild build producing `plugin.js`; the vendored SDK is apiVersion 30 and the manifest declares `screen` (apiVersion 14, needs Kino 0.9.74+). Playback (sports and regional signals) is unchanged, and the channels still appear in Kino's global "Live" tab.

## 0.4.0

- The site moved from `cablevisionhd.com` to `www.cablevisionhd.org` and changed its shape, so every channel stopped working: the grid is now the home page (the old `/parrilla-directo.php` is gone), each channel card is `<a class="channel" href=".../<name>-en-vivo.php">` with its title in `<div class="channel-name">` (was `channel-card` with a `<p>`), and a channel page lists its signals in a `const SOURCES = {1:".../live/core.php?canal=X", 2:".../live2/...", 3:".../live3/..."}` script object (was `<a class="option">`). The plugin follows the new host and shape; the player hosts (`deportes.*`, `regionales.*`) and the `var src` playlist did not change, so resolving still works once the new signal URLs are read. The `.org` hosts are added to the manifest.
  / El sitio pasó de `cablevisionhd.com` a `www.cablevisionhd.org` y cambió de forma, y todos los canales dejaron de funcionar: la parrilla es ahora la portada, cada tarjeta es `<a class="channel" href=".../<nombre>-en-vivo.php">` con el título en `<div class="channel-name">`, y la página de canal lista sus señales en un objeto `const SOURCES = {…}`. El plugin sigue el host y la forma nuevos; los hosts del reproductor y el `var src` no cambiaron.

## 0.3.4

- The manifest declares `streamHosts: "any"`, so a channel whose playlist lives on a host not listed in the manifest still plays.
  / El manifiesto declara `streamHosts: "any"`, para que un canal cuyo m3u8 vive en un host no listado igual reproduzca.

## 0.3.3

- Entertainment, news, movie and kids channels play again. Their signal host (`regionales.*`) answers "Embedding domain not allowed" unless the player is fetched with the exact `core.php` page that embeds it as the `Referer`; the plugin was sending the site's home page, so only the sports host (`deportes.*`, lenient) resolved. It now sends the embedding page, the Referer a browser sends, and both signal hosts play.
  / Vuelven a reproducir los canales de entretenimiento, noticias, películas e infantil: su servidor de señal (`regionales.*`) exigía como `Referer` la página `core.php` que embebe el reproductor; el plugin mandaba la portada del sitio, así que solo resolvía el host de deportes.

## 0.3.2

- Home (and every call) leaves at its own budget: Kino waits for every request a call left running before it delivers the answer, so a Home that skipped a slow row was still held until that request ended or retried (measured on users' devices: Home ran 21-34 s with rows logged as skipped, and Kino threw the answer away at 20 s). The plugin now asks Kino to drop what a call leaves running (`globalThis.__kinoDropPendingFetches = true`, read by Kino 0.9.55 and later; an older Kino ignores it), with a test (`test/dropFetches.test.mjs`).

## 0.3.1

- Diagnostic sharing (`telemetry`): with the person's consent, failed calls send their log lines to Kino's error log, so the next site change shows up sooner.
  / Registros de diagnóstico (`telemetry`): con permiso de la persona, las llamadas que fallan envían sus líneas al registro de errores de Kino.

## 0.3.0

- Fewer failures, from what GlitchTip showed (network, timeout and server-error events on real devices): the plugin goes straight to
  `cablevisionhd.com` (the `www.` host only redirects to it), retries a server error or a network failure once, and **keeps the channel list
  for a week** so a site that does not answer shows the last list instead of an error.
  / Menos fallos: va directo a `cablevisionhd.com`, reintenta una vez y guarda la lista de canales una semana.
- A channel opens faster when its first signal is slow or dead: the next option starts when the first fails or after 5 s, and a whole resolve is
  bounded to 18 s (the app waits 20 s).
  / Un canal abre más rápido: la siguiente opción arranca si la primera falla o tarda más de 5 s; todo el proceso se limita a 18 s.

## 0.2.0

- Uses more of Kino's plugin API: **Home rows** of live channels per group (each with its logo and a "Ver más"), a **section of its own**
  ("TV en vivo", a tab per group that has channels and a hero with the first channel's logo), **categories** (a tile per group), **search**
  (by channel name, and inside a group's "Ver más" page: `scopedSearch`), a **settings form** (preferred signal option, check the signal
  before opening, refresh the grid, clear the cache, and a status line with the number of channels) and a rose **theme**. Needs Kino 0.9.55.
  / Aprovecha más la API de Kino: filas de canales en Inicio, sección propia con una pestaña por grupo, categorías, búsqueda (también
  dentro de un grupo), ajustes (opción de señal preferida, comprobar la señal, actualizar la parrilla, vaciar la caché) y tema rosa.

## 0.1.2

- Icon: the site's own CablevisionHD logo on black, with a rose line.
  / Icono: el logo de CablevisionHD del sitio sobre negro, con una línea rosa.

## 0.1.1

- Icon, description and homepage; the plugin now appears in the community search (topic `kino-plugin`).
  / Icono, descripción y página; el plugin ya aparece en la búsqueda de la comunidad.

## 0.1.0

- First version: the channel grid, seven groups by name, search, and the player playlist of each channel (63 of 74 channels play; the rest are off air on the site).
  / Primera versión: parrilla de canales, siete grupos por nombre, búsqueda y la lista de reproducción de cada canal.
