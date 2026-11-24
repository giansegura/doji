# doji

Gráficos de bolsa privados, en local: velas diarias y semanales, volumen, RSI, medias móviles, líneas de tendencia y listas de seguimiento, con tema claro y oscuro.

La interfaz está en inglés.

## Arrancar

```bash
npm install     # solo la primera vez
npm start       # compila y abre el servidor
```

Después abre <http://127.0.0.1:4780>.

Para otro puerto: `PORT=4790 npm start`.

## Uso

- **Símbolo:** el botón de arriba a la izquierda abre el buscador (ticker o nombre de empresa). `Enter` elige el primer resultado, aunque lo pulses antes de que termine la búsqueda.
- **Periodo:** `D` diario, `W` semanal, `M` mensual.
- **Dos gráficos:** el botón que hay junto a los periodos abre un segundo gráfico de la misma acción al lado del primero, con su propio periodo (selector `D`/`W`/`M` en su esquina). Comparten dibujos, indicadores y herramienta: una línea trazada sobre el precio en uno aparece en el otro. Los dibujos hechos sobre el RSI solo se ven en el periodo en que se dibujaron, porque el RSI cambia con el periodo.
- **Indicadores:** volumen, RSI, Bandas de Bollinger y MACD se activan o quitan desde el menú "Indicators", cada uno con sus ajustes. El volumen puede llevar su media móvil. El MACD va en un panel propio, debajo del RSI.
- **Medias móviles:** en el mismo menú, "Add moving average" (hasta seis). Se calculan sobre el cierre y cada una puede ser simple o exponencial con el botón `SMA`/`EMA`. Cada una tiene su periodo; el círculo de color abre la paleta (16 colores, o cualquier otro con el selector) y el grosor; la `×` la quita.
- **Gráfico:** el menú "Chart" cambia el tipo (velas, barras, línea, área, línea base), la escala de precios (normal, logarítmica, porcentaje, indexada a 100, invertida) y el cursor (libre o imán). El icono de la cámara guarda una imagen del gráfico.
- **Configuración:** el menú "Settings" exporta todo (listas, líneas, indicadores, tema y ajustes del gráfico) a un archivo `doji-config-AAAA-MM-DD.json` y lo vuelve a importar. Importar reemplaza la configuración actual entera, por eso pide confirmación.
- **Mover el gráfico:** arrastra para desplazarlo en el tiempo; el precio se encaja solo a la pantalla. Si empiezas el arrastre hacia arriba o hacia abajo, el gráfico se mueve también en vertical y deja de encajarse: desde ese momento se arrastra libre en cualquier dirección. El botón "Auto" de la esquina inferior derecha, o un doble clic en el eje de precios, lo vuelve a encajar; al cambiar de acción se encaja solo.
- **Línea de tendencia:** elige la herramienta en la barra izquierda y haz clic en dos puntos, sobre el precio o sobre el RSI.
  - Clic en una línea para seleccionarla; arrastra un extremo o el cuerpo para moverla.
  - Con la línea seleccionada aparece una barra para cambiar color, grosor, extenderla a la derecha o borrarla.
  - `Supr` borra la línea seleccionada; `Esc` cancela una línea a medias o suelta la herramienta.
  - Una línea puede acabar más allá de la última vela. Ese tramo se cuenta en días de bolsa: sin fines de semana y, en acciones de EE. UU., sin los festivos de su bolsa.
- **Otras herramientas de dibujo**, en la misma barra izquierda. Se seleccionan, mueven, colorean y borran igual que una línea de tendencia.
  - "Horizontal line": un clic pone un nivel que cruza todo el gráfico, con su precio en el eje. Se arrastra arriba y abajo desde cualquier punto.
  - "Parallel channel": tres clics. Los dos primeros trazan la línea base y el tercero da el ancho. El punto central de la segunda línea cambia el ancho; cualquiera de las dos líneas mueve el canal entero.
  - "Rectangle": dos clics en esquinas opuestas. Cada esquina lo redimensiona y los lados lo mueven.
  - Canales y rectángulos solo se agarran por sus bordes: un clic dentro mueve el gráfico, no el dibujo.
- **Alertas:** con una línea de tendencia o una línea horizontal seleccionada, la campana de su barra arma una alerta; la línea queda marcada con un círculo. Cuando el precio la cruza, doji muestra un aviso en pantalla y una notificación del Mac (la primera vez el navegador pide permiso), y la alerta se desarma.
  - Solo funcionan con doji abierto en una pestaña. Con la pestaña en segundo plano el navegador las comprueba más despacio, más o menos una vez por minuto.
  - Cuentan también los precios de pre y post mercado.
  - Una línea de tendencia que no se extiende a la derecha deja de avisar pasada su última fecha.
  - El nivel de una línea de tendencia se calcula contando días laborables entre sus extremos. En semanas con festivos puede quedar ligeramente por encima o por debajo de lo que se ve dibujado.
- **Deshacer:** `Cmd+Z` (o `Ctrl+Z`) deshace el último cambio en los dibujos de la acción que estás viendo; con `Shift`, lo rehace. Un arrastre entero cuenta como un solo cambio.
- **Atajos:** las flechas arriba y abajo recorren la lista. `Alt+T` arma la línea de tendencia, `Alt+H` la horizontal, `Alt+C` el canal y `Alt+R` el rectángulo; `Esc` vuelve al cursor.
- **Listas:** el nombre de la lista (arriba a la derecha) abre el desplegable para cambiar de lista, crear una nueva, renombrarla, duplicarla o borrarla (pide confirmación). Siempre queda al menos una.
- **Símbolos de la lista:** `+` añade un símbolo a la lista activa; pasa el ratón por una fila para quitarla; arrastra las filas para reordenar.
- **Secciones:** el botón que hay junto a `+` añade un separador con título dentro de la lista. Se arrastra como cualquier fila y, al pasar el ratón, se puede renombrar o quitar.
- **Notas:** el panel "Notes", debajo de la lista, guarda un texto por acción (tesis, precio de entrada, plan). Un punto azul avisa de que la acción tiene nota aunque el panel esté plegado.
- **Ancho de la lista:** arrastra el borde izquierdo de la lista para ensancharla o estrecharla; el gráfico ocupa el resto. Va de 220 a 640 px (400 por defecto) y se guarda con el resto de la configuración. Las columnas se adaptan para que los tickers se lean enteros: por debajo de 381 px se oculta "Ext" y por debajo de 300 px también "Last".
- **Horas extendidas:** la columna "Ext" muestra, en porcentaje, cuánto se separa del cierre el último precio fuera del horario normal, en verde o rojo; al pasar el ratón se ve el precio. Un punto junto al ticker indica la sesión: naranja en el pre-mercado y azul en el post-mercado. Durante la sesión normal, y en lo que no cotiza fuera de horario (índices, cripto, bolsas europeas), muestra un guion. Con el mercado cerrado se queda el último dato del post-mercado hasta que abre el siguiente pre-mercado.

## Dónde se guarda todo

En la carpeta `data/` del proyecto, que no se versiona:

- `data/state.json`: listas de seguimiento, líneas, tema e indicadores. Es el archivo que conviene copiar si quieres una copia de seguridad. "Export settings" te da esa misma copia desde la app, y es la forma de llevar tu configuración a otro ordenador. Se puede importar tanto un archivo exportado como una copia de `state.json`.
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
- Cambiar de acción dentro de la lista es inmediato: al abrir la app se precargan en segundo plano los históricos de la lista activa (hasta 24 acciones), con la copia que el servidor ya tenga y sin consultar a Yahoo. Al cambiar se pinta esa copia y los datos frescos la sustituyen un instante después. Una acción que nunca se ha abierto y no está en la lista sí tiene que descargarse.
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

## Contribuir

- Cada cambio va en una rama y entra por un pull request; a `main` no se sube directamente.
- El título del pull request sigue [Conventional Commits](https://www.conventionalcommits.org/), en inglés: `type(optional-scope): summary`, con el resumen en minúscula inicial y sin punto final. Tipos: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
- Los pull requests se fusionan siempre con squash, y el commit resultante toma el título del pull request.
- Antes de fusionar tienen que pasar tres comprobaciones: `tests`, `build` y `conventional-title`. CodeRabbit revisa cada pull request.

## Avisos

- Proyecto personal, sin relación con TradingView ni con Yahoo. Nada de lo que muestra es una recomendación de inversión.
- El gráfico usa [Lightweight Charts](https://github.com/tradingview/lightweight-charts) (Apache 2.0); el logo de la esquina es la atribución que pide su licencia. TradingView Lightweight Charts™, Copyright (c) 2026 TradingView, Inc. <https://www.tradingview.com/>
- Este repositorio no contiene precios, históricos ni logos. La app los pide desde tu ordenador para tu propio uso; pertenecen a sus dueños y su uso depende de las condiciones de cada servicio.

## Licencia

[MIT](LICENSE). Las dependencias conservan cada una la suya.
