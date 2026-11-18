# Changelog

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
