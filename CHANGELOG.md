# Changelog

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
