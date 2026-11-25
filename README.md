<img src="public/favicon.svg" width="56" height="56" alt="doji" />

# doji

Gráficos de bolsa privados, en local: velas diarias y semanales, volumen, RSI, medias móviles, líneas de tendencia y listas de seguimiento, con varios temas.

La interfaz está en inglés.

## Arrancar

```bash
npm install     # solo la primera vez
npm start       # compila y abre el servidor
```

Después abre <http://127.0.0.1:4780>.

Para otro puerto: `PORT=4790 npm start`.

## Uso

- **Símbolo:** el botón de arriba a la izquierda abre el buscador (ticker o nombre de empresa). `Enter` elige el primer resultado, aunque lo pulses antes de que termine la búsqueda. También encuentra pares de divisas (por ejemplo `EURUSD` o `USDJPY`), que se muestran como en TradingView: sin el `=X` de Yahoo, con las banderas de las dos monedas y cuatro decimales (tres en los pares con yenes).
- **Periodo:** `D` diario, `W` semanal, `M` mensual.
- **Pestaña del navegador:** muestra el ticker, su último precio, una flecha y el cambio del día en porcentaje, los mismos de la lista.
- **Temas:** el botón de la paleta, arriba a la derecha, elige entre **Doji** (el tema por defecto: tinta cálida y violeta), **Midnight** (el aspecto oscuro anterior, negro con el gráfico azul marino) y **Light**. Se guarda con el resto de la configuración; las configuraciones guardadas con el antiguo tema oscuro abren en Midnight.
- **Dos gráficos:** el botón que hay junto a los periodos abre un segundo gráfico de la misma acción al lado del primero, con su propio periodo (selector `D`/`W`/`M` en su esquina). Comparten dibujos, indicadores y herramienta: una línea trazada sobre el precio en uno aparece en el otro. Los dibujos hechos sobre el RSI solo se ven en el periodo en que se dibujaron, porque el RSI cambia con el periodo.
- **Indicadores:** volumen, RSI, Bandas de Bollinger y MACD se activan o quitan desde el menú "Indicators", cada uno con sus ajustes. El volumen puede llevar su media móvil. El MACD va en un panel propio, debajo del RSI.
- **Soportes y resistencias:** en el menú "Indicators", "Support & resistance" dibuja en el gráfico los niveles donde el precio ha rebotado más veces: líneas blancas finas, discontinuas y tenues (oscuras en el tema Light). "Per side" elige cuántos por encima y por debajo del precio (3 por defecto). Se calculan al abrir cada acción con todo su histórico diario, así que siempre están al día y no guardan nada.
  - Cómo los busca: los giros de las velas semanales (el punto más alto o más bajo de 5 semanas a cada lado), agrupados cuando están cerca; cuenta las semanas en que el precio entró en la zona y cerró rechazado, y da más peso a las zonas con más toques, a las que han sido soporte y resistencia, a las de más volumen y a las recientes. Solo enseña niveles a menos de un 30 % del precio, separados entre sí, y el máximo histórico si está a menos de un 15 %. Con menos de dos años de historia usa velas diarias.
  - Un clic en un nivel lo fija: se convierte en una línea horizontal tuya, con el mismo aspecto, que ya puedes mover, editar, ponerle alerta o texto.
  - La IA conectada por MCP también los ve: `get_chart` los incluye y `scan_watchlist` da la distancia al soporte y a la resistencia más cercanos.
- **Perfil de volumen:** en el mismo menú, "Volume profile" muestra a la derecha del gráfico cuánto se negoció a cada precio en el tramo que estás viendo, y se recalcula al mover o acercar el gráfico. Cada fila separa el volumen de las velas alcistas y bajistas; las filas que reúnen el 70 % del volumen (el área de valor) se ven más intensas y una línea marca el precio con más volumen (POC). "Rows" elige en cuántas filas se reparte (24 por defecto). Se calcula con velas diarias, semanales o mensuales, así que es una aproximación.
- **Resultados:** una marca "E" en la parte de abajo del gráfico señala las cuatro últimas presentaciones de resultados (rellena) y la próxima (hueca), y la leyenda dice la fecha de la próxima (con `~` si Yahoo solo la estima). Las fechas vienen de Yahoo y se guardan 12 horas; los ETF y las divisas no tienen.
- **Calendario de resultados:** el botón del calendario, arriba a la derecha, abre una semana de lunes a viernes con las empresas de tus listas que presentan resultados cada día. Los fines de semana solo salen si alguien presenta. ☀ es antes de la apertura, ☾ tras el cierre y `~` una fecha que Yahoo solo estima; las ya pasadas se ven más tenues. Las flechas cambian de semana, "This week" vuelve a la actual y "Show" filtra por lista. Un clic en una empresa abre su gráfico.
  - Las fechas se guardan en `data/cache/earnings.json` y se refrescan cada 12 horas. La primera vez tardan uno o dos minutos en llegar todas; mientras, el calendario dice cuántas faltan.
  - Abajo, "Warn in the watchlist…" pone una marca `E 3d` en las filas de la lista activa cuyas empresas presentan en 7 días o menos (`E` si es hoy). Está apagado por defecto.
  - La IA conectada por MCP tiene `get_earnings_calendar`: qué presenta entre dos fechas, en todas las listas o en una.
- **Medias móviles:** en el mismo menú, "Add moving average" (hasta seis). Se calculan sobre el cierre y cada una puede ser simple o exponencial con el botón `SMA`/`EMA`. Cada una tiene su periodo; el círculo de color abre la paleta (16 colores, o cualquier otro con el selector) y el grosor; la `×` la quita.
- **Gráfico:** el menú "Chart" cambia el tipo (velas, barras, línea, área, línea base), la escala de precios (normal, logarítmica, porcentaje, indexada a 100, invertida) y el cursor (libre o imán). El icono de la cámara guarda una imagen del gráfico.
- **Configuración:** el menú "Settings" exporta todo (listas, líneas, indicadores, tema y ajustes del gráfico) a un archivo `doji-config-AAAA-MM-DD.json` y lo vuelve a importar. Importar reemplaza la configuración actual entera, por eso pide confirmación.
- **Mover el gráfico:** arrastra para desplazarlo en el tiempo; el precio se encaja solo a la pantalla. Si empiezas el arrastre hacia arriba o hacia abajo, el gráfico se mueve también en vertical y deja de encajarse: desde ese momento se arrastra libre en cualquier dirección. El botón "Auto" de la esquina inferior derecha, o un doble clic en el eje de precios, lo vuelve a encajar; al cambiar de acción se encaja solo.
- **Cada acción recuerda su vista:** al volver a una acción, el gráfico enseña el mismo tramo de fechas y, si lo habías movido en vertical, la misma altura. Se guarda en el navegador, así que también sobrevive a recargar la página; el segundo gráfico tiene su propia memoria. Si vuelves en otro periodo (semanal en vez de diario), se enseñan las mismas fechas y el ajuste vertical vuelve a automático.
- **Línea de tendencia:** elige la herramienta en la barra izquierda y haz clic en dos puntos, sobre el precio o sobre el RSI.
  - Clic en una línea para seleccionarla; arrastra un extremo o el cuerpo para moverla.
  - Con la línea seleccionada aparece una barra para cambiar el color (incluido el blanco), extenderla a la derecha o borrarla. Su botón "Line style" abre un panel con el grosor, el trazo (continuo, discontinuo o de puntos) y la opacidad. En una línea horizontal, el botón de la etiqueta muestra u oculta su precio en el eje.
  - En la misma barra, "Text" escribe un texto sobre la línea (por ejemplo "R1" o "soporte semanal"); se guarda al pulsar `Enter` o al salir del campo. En la horizontal va a la derecha, encima de la línea; en la de tendencia, encima de su punto medio.
  - doji recuerda el último aspecto que diste a cada tipo de dibujo: si dejas una horizontal blanca, discontinua y al 50 %, la siguiente horizontal sale igual.
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
- **Regla:** "Measure" en la barra izquierda (o `Alt+M`). Un clic marca el inicio y otro el final, o arrastra. Muestra el cambio de precio y en %, el número de velas y los días naturales. No se guarda: desaparece con el siguiente clic o con `Esc`.
- **Deshacer:** `Cmd+Z` (o `Ctrl+Z`) deshace el último cambio en los dibujos de la acción que estás viendo; con `Shift`, lo rehace. Un arrastre entero cuenta como un solo cambio.
- **Atajos:** las flechas arriba y abajo recorren la lista. `Alt+T` arma la línea de tendencia, `Alt+H` la horizontal, `Alt+C` el canal, `Alt+R` el rectángulo y `Alt+M` la regla; `Esc` vuelve al cursor.
- **Listas:** el nombre de la lista (arriba a la derecha) abre el desplegable para cambiar de lista, crear una nueva, renombrarla, duplicarla o borrarla (pide confirmación). Siempre queda al menos una.
- **Símbolos de la lista:** `+` abre el buscador para añadir a la lista activa; puedes añadir varios seguidos escribiendo el ticker y pulsando `Enter`, y cerrarlo con `Esc`. Añadir no cambia el gráfico. Pasa el ratón por una fila para quitarla; arrastra las filas para reordenar.
- **Icono de una lista:** en el desplegable de listas, el botón de la cara abre una paleta de 163 emojis por grupos (mercado, sectores, países, colores y señales, animales). También puedes escribir cualquier otro y pulsar `Enter` (en Mac, `⌃⌘Espacio` abre todos los emojis del sistema) o quitarlo con «No icon». El icono se ve delante del nombre.
- **Ordenar la lista:** pulsa la cabecera de una columna (Symbol, Last, Chg% o Ext) para ordenar de mayor a menor (de la A a la Z en Symbol); un segundo clic invierte el orden y el tercero vuelve a tu orden. Las secciones se respetan: se ordena dentro de cada una. Mientras hay un orden activo no se pueden arrastrar filas.
- **Secciones:** el botón que hay junto a `+` añade un separador con título dentro de la lista. Se arrastra como cualquier fila y, al pasar el ratón, se puede renombrar o quitar.
- **Notas:** el panel "Notes", debajo de la lista, guarda un texto por acción (tesis, precio de entrada, plan). Un punto azul avisa de que la acción tiene nota aunque el panel esté plegado.
- **Ancho de la lista:** arrastra el borde izquierdo de la lista para ensancharla o estrecharla; el gráfico ocupa el resto. Va de 220 a 640 px (400 por defecto) y se guarda con el resto de la configuración. Las columnas se adaptan para que los tickers se lean enteros: por debajo de 381 px se oculta "Ext" y por debajo de 300 px también "Last".
- **Horas extendidas:** la columna "Ext" muestra, en porcentaje, cuánto se separa del cierre el último precio fuera del horario normal, en verde o rojo; al pasar el ratón se ve el precio. Un punto junto al ticker indica la sesión: naranja en el pre-mercado y azul en el post-mercado. Durante la sesión normal, y en lo que no cotiza fuera de horario (índices, cripto, bolsas europeas), muestra un guion. Con el mercado cerrado se queda el último dato del post-mercado hasta que abre el siguiente pre-mercado.

## Conectar tu IA (MCP)

doji trae un servidor [MCP](https://modelcontextprotocol.io) para que la aplicación de IA que uses (Claude, ChatGPT, Gemini, Copilot…) lea tus gráficos y trabaje sobre ellos con tu propia suscripción. doji no llama a ninguna IA ni necesita claves.

Herramientas que ofrece:

| Herramienta | Qué hace |
|---|---|
| `get_watchlists` | Tus listas, con sus secciones, cuál está activa y qué hay en pantalla. |
| `scan_watchlist` | Revisa una lista entera: precio, cambio, RSI, distancia a las SMA 50 y 200, rango de 52 semanas, MACD, volumen, alertas y notas. |
| `get_chart` | Resumen de un gráfico con indicadores calculados por doji, máximos y mínimos recientes, últimas velas, tus dibujos y tu nota. |
| `get_earnings_calendar` | Quién presenta resultados entre dos fechas, en todas tus listas o en una, con la hora (antes de abrir o tras el cierre) si se sabe. |
| `add_horizontal_line` | Dibuja una línea horizontal, con alerta si se pide. |
| `set_alert` | Arma o desarma la alerta de una línea existente. |
| `write_note` | Escribe en la nota de una acción. |
| `create_watchlist` | Crea una lista, con sus símbolos si se le dan, sin cambiar la que tienes en pantalla. |
| `add_to_watchlist` | Añade símbolos a una lista, al final o dentro de una de sus secciones. |
| `add_section` | Añade una sección a una lista. |
| `remove_from_watchlist` | Quita símbolos de una lista; sus dibujos, alertas y notas se quedan. |
| `rename_watchlist` | Cambia el nombre de una lista. |
| `set_watchlist_icon` | Pone o quita el emoji de una lista (`create_watchlist` también acepta uno). |

La IA no puede borrar listas enteras ni dibujos. Sí puede quitar símbolos de una lista (`remove_from_watchlist`) y `write_note` en modo `replace` sustituye la nota entera; las aplicaciones de IA suelen pedir confirmación antes de usar herramientas marcadas como destructivas. Lo que añade aparece en doji en unos segundos, sin recargar; las alertas solo saltan con doji abierto en una pestaña.

Para usarlo, doji tiene que estar en marcha (`npm start`). Después se registra en tu aplicación de IA el comando `<doji>/node_modules/.bin/tsx <doji>/mcp/index.ts`, cambiando `<doji>` por la ruta completa de la carpeta:

- **Claude Code:** `claude mcp add --scope user doji -- <doji>/node_modules/.bin/tsx <doji>/mcp/index.ts`
- **Claude Desktop**, en `claude_desktop_config.json`:

  ```json
  { "mcpServers": { "doji": { "command": "<doji>/node_modules/.bin/tsx", "args": ["<doji>/mcp/index.ts"] } } }
  ```

- **Codex y la app de escritorio de ChatGPT**, en `~/.codex/config.toml`:

  ```toml
  [mcp_servers.doji]
  command = "<doji>/node_modules/.bin/tsx"
  args = ["<doji>/mcp/index.ts"]
  ```

- **GitHub Copilot CLI:** `copilot mcp add doji -- <doji>/node_modules/.bin/tsx <doji>/mcp/index.ts`
- **Otras aplicaciones:** cualquiera que admita servidores MCP locales (stdio) con ese comando y ese argumento.

Si doji corre en otro puerto, añade la variable de entorno `DOJI_URL=http://127.0.0.1:<puerto>`. ChatGPT en el navegador no puede conectarse: solo llega a servidores accesibles desde internet, y doji solo escucha en tu ordenador.

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

- **Precios en vivo.** Con la pestaña visible, el servidor abre una única conexión con el canal de precios de Yahoo (un WebSocket) y reenvía cada cambio al navegador. La lista, el título de la pestaña, las alertas y la última vela (también en semanal y mensual, con sus indicadores) siguen al precio más o menos una vez por segundo. Un punto verde junto al nombre de la lista indica que están llegando precios en vivo; gris, que se está usando la consulta de respaldo.
  - En las acciones de EE. UU. y en divisas el retraso ronda 1–2 segundos. Las bolsas europeas llegan por el mismo canal, pero con los 15 minutos de retraso con que Yahoo las publica.
  - La consulta de respaldo sigue funcionando: cada 15 segundos para los símbolos que no han recibido ningún precio en vivo en el último medio minuto (mercado cerrado, índices y futuros que Yahoo no emite, canal caído) y cada minuto para todos. Si el canal deja de funcionar, doji se comporta como antes de tenerlo.
  - Nunca retrocede: un precio solo sustituye a otro si su operación es posterior, venga del canal, de la consulta o del histórico.
  - Cuando el precio de una fila cambia, la cifra se pone un instante en verde (sube) o en rojo (baja), y los dígitos que han cambiado siguen coloreados un par de segundos más.
  - La vela del día conserva el máximo y el mínimo por los que ha pasado el precio en vivo aunque el histórico todavía no los traiga.
  - La conexión con Yahoo se cierra 10 segundos después de que la última pestaña deje de mirar, y se reintenta con esperas crecientes (de 1 segundo a 1 minuto) si se cae. En pestañas ocultas no se usa, salvo que haya alertas armadas.
  - En pre y post mercado, la columna "Ext" se mueve con el canal solo después de que la consulta confirme en qué sesión está el símbolo.
- Sin el canal, el precio y la vela del día se refrescan cada 15 segundos con la pestaña visible.
- Si Yahoo no responde, se muestra el último histórico guardado con un aviso de su fecha.
- Los logos se piden primero a Finnhub (fichas cuadradas con el color de la marca; solo se aceptan las grandes), después a Yahoo y, si ninguno lo tiene, a `financialmodelingprep.com`; a los servicios que no son Yahoo solo se les envía el ticker. Se guardan en disco y no se vuelven a pedir en un mes, salvo que cambie la lista de fuentes. La app mira los píxeles de cada logo para pintarlo bien: una ficha de color llena el círculo, un logo suelto va sobre blanco con margen y un logo blanco va sobre un círculo oscuro. Sin logo se muestra la inicial.
- El histórico completo de cada acción se vuelve a descargar cada 12 horas; entre medias solo se piden los últimos días.
- Cambiar de acción dentro de la lista es inmediato: al abrir la app se precargan en segundo plano los históricos de la lista activa (hasta 24 acciones), con la copia que el servidor ya tenga y sin consultar a Yahoo. Al cambiar se pinta esa copia y los datos frescos la sustituyen un instante después. Una acción que nunca se ha abierto y no está en la lista sí tiene que descargarse.
- Todo lo que habla con Yahoo está en `server/provider/`: `yahoo.ts` (históricos, precios, búsqueda), `yahooStream.ts` (canal en vivo) y `pricing.ts` (formato de sus mensajes). Cambiar de fuente es reescribir esos archivos. Las fuentes de logos están en `server/logoSources.ts`.

## Límites conocidos

- Los festivos solo se conocen para la bolsa de EE. UU., y solo se aplican cuando el histórico de la acción demuestra que los respeta (al menos tres festivos sin vela en el último año). En otros mercados, y con cierres imprevistos, una línea con un extremo en el futuro se desplaza una vela por cada festivo que pasa.
- En instrumentos que cotizan en fin de semana, el tramo posterior a la última vela se cuenta en días laborables.
- El arrastre de filas de la lista está probado en Chrome; en Firefox no se ha comprobado.
- Cada pestaña con precios en vivo mantiene una conexión abierta con el servidor, y los navegadores admiten unas seis por sitio: con más de cinco pestañas de doji visibles a la vez (o con alertas armadas), las siguientes se quedan esperando.
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
