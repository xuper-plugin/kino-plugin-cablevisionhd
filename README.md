# CablevisionHD para Kino

Plugin de [Kino](https://github.com/kinotvapp/kino-light) que agrega los **canales de TV en vivo** de
[www.cablevisionhd.org](https://www.cablevisionhd.org/): deportes, entretenimiento, noticias,
películas, infantil y más (unos 70 canales), con una **pantalla propia** y en la pestaña **En vivo** de Kino.

> Plugin no oficial. Los canales y sus señales pertenecen a cablevisionhd.org y a sus servidores; este plugin solo los lista
> y abre dentro de Kino.

## Instalar

En Kino: **Ajustes ▸ Plugins ▸ Agregar**, y pega:

```
xuper-plugin/kino-plugin-cablevisionhd
```

Kino pide un permiso en rojo: *puede reproducir canales desde cualquier servidor que indique su lista* (`liveStreamHosts`).
Hace falta porque las señales salen de dos servidores del sitio que cambian de nombre con el tiempo.

## Qué trae

- **Pantalla propia de CablevisionHD** (se abre desde el menú): una barra de pestañas por grupo (Todos, Deportes, Entretenimiento,
  Noticias, Películas, Infantil, Educación, 24/7 — solo los que tengan canales) y una **rejilla de logos**. Al tocar un canal se reproduce.
  Adaptativa: rejilla en teléfono/escritorio, canales redondos con foco de control remoto en la TV.
- **La pestaña En vivo de Kino** con los mismos canales y la búsqueda por nombre (los canales también salen en la búsqueda global de Kino).
- **Ajustes dentro de la pantalla**: opción de señal preferida (automática, 1, 2 o 3), comprobar la señal antes de abrir, actualizar la
  parrilla y vaciar la caché, con una línea que dice cuántos canales hay.

## Cómo funciona

- La lista sale de la **portada** de `www.cablevisionhd.org` y se agrupa por nombre (Deportes, Entretenimiento, Noticias, Películas,
  Infantil, Educación, 24/7), porque el sitio no tiene categorías. Se guarda 10 minutos (y hasta una semana como respaldo si el sitio no responde).
- Al abrir un canal, el plugin pide su página, sigue la **Opción 1** (iframe → página del reproductor → dirección HLS con
  token) y entrega la lista de reproducción. Las otras opciones (hasta tres) quedan en el menú **Servidor**.
- El token de la señal dura unas horas; si un canal se corta, vuelve a abrirlo.

## Límites

- Si el sitio cambia su marcado, el canal falla con un aviso («Este canal no está disponible ahora»), no con una pantalla en blanco.
- No hay guía de programación (el sitio no la publica).

## Desarrollo

El código vive en `src/` y un build con esbuild produce `plugin.js` (el bundle que corre Kino).

```
npm run build       # src/ -> plugin.js (esbuild)
npm test            # pruebas sin red
npm run validate    # build + valida el manifiesto con el kit
node sdk/run.mjs . screen              # imprime y valida la pantalla
node sdk/run.mjs ./plugin.js resolve tudn-en-vivo
```

Licencia Apache-2.0 (ver `LICENSE` y `NOTICE`).
