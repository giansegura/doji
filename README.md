# doji

Gráficos de bolsa privados, en local: velas diarias y semanales, volumen, RSI, medias móviles, líneas de tendencia y listas de seguimiento, con tema claro y oscuro.

## Arrancar

```bash
npm install     # solo la primera vez
npm start       # compila y abre el servidor
```

Después abre <http://127.0.0.1:4780>.

Para otro puerto: `PORT=4790 npm start`.

## Uso

- **Símbolo:** el botón de arriba a la izquierda abre el buscador (ticker o nombre de empresa). `Enter` elige el primer resultado, aunque lo pulses antes de que termine la búsqueda.
- **Periodo:** `D` diario, `W` semanal.
- **Indicadores:** volumen y RSI se activan o quitan desde el menú; el periodo del RSI y su media se ajustan ahí.
- **Medias móviles (SMA):** en el mismo menú, "Añadir media móvil" (hasta seis). Se calculan sobre el cierre. Cada una tiene su periodo; el círculo de color abre la paleta (16 colores, o cualquier otro con el selector) y el grosor; la `×` la quita.
- **Gráfico:** el menú "Gráfico" cambia el tipo (velas, barras, línea, área, línea base), la escala de precios (normal, logarítmica, porcentaje, indexada a 100, invertida) y el cursor (libre o imán). El icono de la cámara guarda una imagen del gráfico.
- **Línea de tendencia:** elige la herramienta en la barra izquierda y haz clic en dos puntos, sobre el precio o sobre el RSI.
  - Clic en una línea para seleccionarla; arrastra un extremo o el cuerpo para moverla.
  - Con la línea seleccionada aparece una barra para cambiar color, grosor, extenderla a la derecha o borrarla.
  - `Supr` borra la línea seleccionada; `Esc` cancela una línea a medias o suelta la herramienta.
  - Una línea puede acabar más allá de la última vela. Ese tramo se cuenta en días de bolsa: sin fines de semana y, en acciones de EE. UU., sin los festivos de su bolsa.
- **Listas:** el nombre de la lista (arriba a la derecha) abre el desplegable para cambiar de lista, crear una nueva, renombrarla, duplicarla o borrarla (pide confirmación). Siempre queda al menos una.
- **Símbolos de la lista:** `+` añade un símbolo a la lista activa; pasa el ratón por una fila para quitarla; arrastra las filas para reordenar.

## Dónde se guarda todo

En la carpeta `data/` del proyecto, que no se versiona:

- `data/state.json`: listas de seguimiento, líneas, tema e indicadores. Es el archivo que conviene copiar si quieres una copia de seguridad.
- `data/state.json.bak-AAAA-MM-DD`: copia automática del estado tal como estaba antes del primer cambio de cada día. Se conservan las siete últimas.
- `data/state.json.corrupt-…`: si alguna vez el archivo no se puede leer como JSON, se guarda aparte con este nombre y la app arranca con valores por defecto.
- `data/cache/`: histórico descargado de cada acción y logos de las empresas. Se puede borrar sin perder nada.

`DOJI_DATA_DIR=/otra/carpeta npm start` usa otra carpeta.

Puedes tener la app abierta en varias pestañas: cada una guarda sobre la versión que cargó, y si otra pestaña cambió algo antes, se recarga con lo último en lugar de pisarlo (el cambio que no llegó a guardarse en esa pestaña se pierde y se avisa).

## Datos

Los precios salen de los endpoints públicos de Yahoo Finance. No es una API oficial: puede cambiar o dejar de responder sin aviso, y los precios llegan con retraso.

- El precio y la vela del día se refrescan cada 15 segundos con la pestaña visible.
- Si Yahoo no responde, se muestra el último histórico guardado con un aviso de su fecha.
- Los logos se piden primero a Yahoo y, si no lo tiene, a `financialmodelingprep.com`; a ese segundo servicio solo se le envía el ticker. Se guardan en disco y no se vuelven a pedir en un mes. Sin logo se muestra la inicial.
- El histórico completo de cada acción se vuelve a descargar cada 12 horas; entre medias solo se piden los últimos días.
- Todo lo que habla con Yahoo está en `server/provider/yahoo.ts`; cambiar de fuente es reescribir ese archivo. La segunda fuente de logos se configura en `server/index.ts`.

## Límites conocidos

- Los festivos solo se conocen para la bolsa de EE. UU., y solo se aplican cuando el histórico de la acción demuestra que los respeta (al menos tres festivos sin vela en el último año). En otros mercados, y con cierres imprevistos, una línea con un extremo en el futuro se desplaza una vela por cada festivo que pasa.
- En instrumentos que cotizan en fin de semana, el tramo posterior a la última vela se cuenta en días laborables.
- El arrastre de filas de la lista está probado en Chrome; en Firefox no se ha comprobado.
- El servidor solo escucha en `127.0.0.1` y rechaza las peticiones a `/api` que haga otra web desde el navegador.

## Desarrollo

```bash
npm run dev     # servidor y Vite con recarga en caliente (http://127.0.0.1:5173)
npm test        # tests
npm run smoke -- http://127.0.0.1:4780 /tmp/capturas   # prueba completa en Chrome; necesita la app en marcha
```

La prueba completa dibuja y borra líneas y cambia el tema y la lista: ejecútala contra una carpeta de datos de prueba (`DOJI_DATA_DIR`), no contra la tuya.

## Avisos

- Proyecto personal, sin relación con TradingView ni con Yahoo. Nada de lo que muestra es una recomendación de inversión.
- El gráfico usa [Lightweight Charts](https://github.com/tradingview/lightweight-charts) (Apache 2.0); el logo de la esquina es la atribución que pide su licencia. TradingView Lightweight Charts™, Copyright (c) 2026 TradingView, Inc. <https://www.tradingview.com/>
- Este repositorio no contiene precios, históricos ni logos. La app los pide desde tu ordenador para tu propio uso; pertenecen a sus dueños y su uso depende de las condiciones de cada servicio.

## Licencia

[MIT](LICENSE). Las dependencias conservan cada una la suya.
