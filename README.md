# CablevisionHD para Kino

Plugin de [Kino](https://github.com/kinotvapp/kino-light) que agrega los **canales de TV en vivo** de
[cablevisionhd.com](https://www.cablevisionhd.com/) a la pestaña **En vivo**: deportes, entretenimiento, noticias,
películas, infantil y más (unos 70 canales).

> Plugin no oficial. Los canales y sus señales pertenecen a cablevisionhd.com y a sus servidores; este plugin solo los lista
> y abre dentro de Kino.

## Instalar

En Kino: **Ajustes ▸ Plugins ▸ Agregar**, y pega:

```
xuper-plugin/kino-plugin-cablevisionhd
```

Kino pide un permiso en rojo: *puede reproducir canales desde cualquier servidor que indique su lista* (`liveStreamHosts`).
Hace falta porque las señales salen de dos servidores del sitio que cambian de nombre con el tiempo.

## Qué trae

- **La pestaña En vivo de Kino** con los canales, sus grupos (Deportes, Entretenimiento, Noticias, Películas, Infantil, Educación, 24/7) y la búsqueda.
- **Inicio** con una fila por grupo, cada canal con su logo y «Ver más» a todo el grupo.
- **Una sección propia** («TV en vivo», en Inicio en el teléfono y en la barra lateral en la TV): una pestaña por grupo que tenga canales y un
  destacado con el logo del primero.
- **Categorías** con una ficha por grupo, y **búsqueda** por nombre de canal, también dentro de un grupo («Buscar en esta categoría»).
- **Ajustes ▸ CablevisionHD**: opción de señal preferida (automática, 1, 2 o 3), comprobar la señal antes de abrir, actualizar la parrilla
  y vaciar la caché, con una línea que dice cuántos canales hay.

## Cómo funciona

- La lista sale de `/parrilla-directo.php` y se agrupa por nombre (Deportes, Entretenimiento, Noticias, Películas, Infantil,
  Educación, 24/7), porque el sitio no tiene categorías. Se guarda 10 minutos.
- Al abrir un canal, el plugin pide su página, sigue la **Opción 1** (iframe → página del reproductor → dirección HLS con
  token) y entrega la lista de reproducción. Las otras opciones (hasta tres) quedan en el menú **Servidor**.
- El token de la señal dura unas horas; si un canal se corta, vuelve a abrirlo.

## Límites

- Si el sitio cambia su marcado, el canal falla con un aviso («Este canal no está disponible ahora»), no con una pantalla en blanco.
- No hay guía de programación (el sitio no la publica).

## Desarrollo

```
npm test            # pruebas sin red
npm run validate    # valida el manifiesto con el kit
node sdk/run.mjs . live channels all
node sdk/run.mjs . resolve tudn-ver
```

Licencia Apache-2.0 (ver `LICENSE` y `NOTICE`).
