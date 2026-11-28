# Guía de doji

Todo lo que hace doji, función por función. Para arrancarlo, mira el [README](../README.md).

La interfaz está en inglés: los nombres entre comillas son los que ves en pantalla.

## Gráfico

- **Símbolo:** el botón de arriba a la izquierda abre el buscador (ticker o nombre de empresa). `Enter` elige el primer resultado, aunque lo pulses antes de que termine la búsqueda. También encuentra pares de divisas (por ejemplo `EURUSD` o `USDJPY`), que se muestran como en TradingView: sin el `=X` de Yahoo, con las banderas de las dos monedas y cuatro decimales (tres en los pares con yenes).
- **Criptomonedas, índices y futuros:** el buscador también encuentra criptomonedas (por ejemplo `BTC-USD`, que se ven con la bolsa "Crypto"), índices (`^GSPC`) y futuros (`ES=F`, `CL=F`). Las criptomonedas cotizan todos los días, así que su eje de fechas cuenta también los fines de semana, igual que las líneas de tendencia y sus alertas; los precios muy pequeños se ven con 6 u 8 decimales. Los índices no tienen volumen y casi ninguno tiene logo.
- **Cinta de mercados:** bajo la barra superior, una tira fina con el S&P 500, el Nasdaq, el VIX, el EUR/USD, el oro y el bitcoin: el último precio y el cambio del día en %, en vivo como la lista. Un clic abre su gráfico, y el que está en pantalla se ve resaltado. El lápiz de la derecha la edita: la `×` quita un símbolo, "Add to ticker" abre el buscador para añadir otro (hasta 12) y "Hide ticker" la oculta entera; se vuelve a enseñar en "Settings", con "Market ticker". Se guarda con el resto de la configuración.
- **Escribir un ticker:** con el gráfico delante (sin estar escribiendo en otro campo), pulsar una letra o un número abre el buscador con ese carácter ya puesto; se sigue escribiendo y `Enter` abre el primer resultado. No pasa con un cuadro abierto ni con `Alt`, `Cmd` o `Ctrl`, que siguen siendo de los otros atajos.
- **Periodo:** `D` diario, `W` semanal, `M` mensual.
- **Pestaña del navegador:** muestra el ticker, su último precio, una flecha y el cambio del día en porcentaje, los mismos de la lista.
- **Temas:** el botón de la paleta, arriba a la derecha, elige entre **Doji** (el tema por defecto: tinta cálida y violeta), **Midnight** (el aspecto oscuro anterior, negro con el gráfico azul marino) y **Light**. Se guarda con el resto de la configuración; las configuraciones guardadas con el antiguo tema oscuro abren en Midnight.
- **Dos gráficos:** el botón que hay junto a los periodos abre un segundo gráfico de la misma acción al lado del primero, con su propio periodo (selector `D`/`W`/`M` en su esquina). Comparten dibujos, indicadores y herramienta: una línea trazada sobre el precio en uno aparece en el otro. Los dibujos hechos sobre el RSI solo se ven en el periodo en que se dibujaron, porque el RSI cambia con el periodo.
- **Gráfico:** el menú "Chart" cambia el tipo (velas, barras, línea, área, línea base), la escala de precios (normal, logarítmica, porcentaje, indexada a 100, invertida) y el cursor (libre o imán). El icono de la cámara guarda una imagen del gráfico.
- **En euros:** en el menú "Chart", "Currency" cambia entre la moneda de la acción ("Symbol currency") y euros ("Euros"). Cada vela se convierte con el cambio de su propio día (el par `EURUSD=X`, `EURGBP=X`… de Yahoo, desde 2003; las acciones en peniques o céntimos se pasan antes a libras o rands), y los indicadores, el perfil de volumen, los niveles y los dividendos se calculan sobre los precios ya convertidos. La leyenda dice "in EUR". La lista y la pestaña siguen en la moneda de cada acción.
  - Los dibujos se ven solo en la moneda en que se hicieron: una línea en 100 dólares no es un nivel fijo en euros. Los dibujos hechos en euros no llevan alerta, porque el servidor vigila los precios en la moneda de la acción, y la línea de tu posición no sale en euros.
  - Las velas anteriores a los datos del cambio (2003 para el dólar) no se ven en euros. Una acción que ya cotiza en euros se ve igual.
  - El cambio se vuelve a pedir cada minuto, así que un gráfico abierto mucho rato en euros usa el del momento. Si no llega, el gráfico sigue en la moneda de la acción y la barra de arriba lo avisa hasta que llega. Cada moneda recuerda su propia vista; al cambiar de moneda, la escala de precios vuelve a encajarse sola.
- **Mover el gráfico:** arrastra para desplazarlo en el tiempo; el precio se encaja solo a la pantalla. Si empiezas el arrastre hacia arriba o hacia abajo, el gráfico se mueve también en vertical y deja de encajarse: desde ese momento se arrastra libre en cualquier dirección. El botón "Auto" de la esquina inferior derecha, o un doble clic en el eje de precios, lo vuelve a encajar; al cambiar de acción se encaja solo.
- **Rangos rápidos e ir a una fecha:** bajo el gráfico, 1M, 3M, 6M, YTD (desde el 1 de enero), 1Y, 5Y y All enseñan ese tramo hasta hoy, con el margen de siempre a la derecha, y vuelven a encajar el precio. El campo de fecha de la derecha ("Go to date") centra el gráfico en ese día al pulsar `Enter`, sin cambiar el zoom. El tramo que dejan se recuerda como uno puesto a mano.
- **Cada acción recuerda su vista:** al volver a una acción, el gráfico enseña el mismo tramo de fechas y, si lo habías movido en vertical, la misma altura. Se guarda en el navegador, así que también sobrevive a recargar la página; el segundo gráfico tiene su propia memoria. Si vuelves en otro periodo (semanal en vez de diario), se enseñan las mismas fechas y el ajuste vertical vuelve a automático.
- **Gráfico a todo el ancho:** el botón del panel, el último de arriba a la derecha (o `Alt+W`), pliega la columna de la derecha (lista, posición, ficha, noticias y notas) y el gráfico ocupa su sitio. Se recuerda al recargar y vuelve con el mismo botón.
- **Modo repetición:** el botón "Replay" de la barra superior. Haz clic en una vela y el gráfico oculta todo lo posterior, como si fuera ese día. Abajo, la barra de repetición avanza una vela (o la flecha `→`), reproduce sola a 1×, 3× o 10×, deja elegir otro punto de inicio ("Pick start") y sale ("Exit" o `Esc`).
  - Avanza velas enteras del periodo que tengas en pantalla: días, semanas o meses.
  - Los indicadores, el perfil de volumen y los soportes y resistencias solo ven las velas hasta ese día; tampoco se ven los resultados ni los dividendos que aún no habían llegado, ni el precio en vivo. La lista sigue con sus precios reales.
  - No guarda nada: al salir, al cambiar de acción o al recargar vuelves al presente. Tus dibujos se quedan como están.

## Indicadores

- **Indicadores:** volumen, RSI, Bandas de Bollinger y MACD se activan o quitan desde el menú "Indicators", cada uno con sus ajustes. El volumen puede llevar su media móvil. El MACD va en un panel propio, debajo del RSI.
- **Medias móviles:** en el mismo menú, "Add moving average" (hasta seis). Se calculan sobre el cierre y cada una puede ser simple o exponencial con el botón `SMA`/`EMA`. Cada una tiene su periodo; el círculo de color abre la paleta (16 colores, o cualquier otro con el selector) y el grosor; la `×` la quita.
- **Soportes y resistencias:** en el menú "Indicators", "Support & resistance" dibuja en el gráfico los niveles donde el precio ha rebotado más veces: líneas blancas finas, discontinuas y tenues (oscuras en el tema Light). "Per side" elige cuántos por encima y por debajo del precio (3 por defecto). Se calculan al abrir cada acción con todo su histórico diario, así que siempre están al día y no guardan nada.
  - Cómo los busca: los giros de las velas semanales (el punto más alto o más bajo de 5 semanas a cada lado), agrupados cuando están cerca; cuenta las semanas en que el precio entró en la zona y cerró rechazado, y da más peso a las zonas con más toques, a las que han sido soporte y resistencia, a las de más volumen y a las recientes. Solo enseña niveles a menos de un 30 % del precio, separados entre sí, y el máximo histórico si está a menos de un 15 %. Con menos de dos años de historia usa velas diarias.
  - Un clic en un nivel lo fija: se convierte en una línea horizontal tuya, con el mismo aspecto, que ya puedes mover, editar, ponerle alerta o texto.
  - La IA conectada por MCP también los ve: `get_chart` los incluye y `scan_watchlist` da la distancia al soporte y a la resistencia más cercanos.
- **Patrones de velas:** en "Indicators", "Candle patterns" (apagado por defecto) marca sobre las velas cinco patrones, y debajo se elige cuáles. Como salen muy a menudo, cada uno exige contexto: un movimiento de al menos un 3 % entre la vela de hace cinco y la anterior.
  - Martillo ("Hammer", flecha verde debajo): tras una caída, cuerpo de como mucho un tercio del rango, sombra inferior de al menos el doble del cuerpo y sombra superior no mayor que el cuerpo.
  - Estrella fugaz ("Star", flecha roja encima): lo mismo al revés, tras una subida.
  - Envolvente alcista ("Engulfing", flecha verde debajo): tras una caída, una vela alcista cuyo cuerpo cubre entero el de la anterior, que era bajista. La envolvente bajista (flecha roja encima) es lo mismo al revés, tras una subida.
  - Doji (círculo gris encima): tras una subida o una caída, un cuerpo de como mucho el 5 % del rango. Si la vela ya es otro de los patrones, cuenta como ese.
- **Divergencias del RSI:** en "Indicators", "RSI divergences" (apagado por defecto) une con una línea verde dos mínimos seguidos del precio cuando el segundo es más bajo y el RSI está más alto (divergencia alcista), y con una roja dos máximos cuando el segundo es más alto y el RSI más bajo (bajista). La línea sale sobre el precio y sobre el RSI si su panel está visible. Usa los mismos giros que los soportes y resistencias (el mínimo o máximo de cinco velas a cada lado), así que una divergencia aparece cinco velas después de su segundo giro; solo se unen giros a menos de 80 velas.
- **Huecos sin cerrar:** en "Indicators", "Open gaps" (apagado por defecto) sombrea cada hueco que el precio aún no ha rellenado, desde su vela hasta la derecha: verde si el precio saltó hacia arriba (el mínimo de la vela quedó por encima del máximo de la anterior) y rojo si saltó hacia abajo. Cuando el precio entra en el hueco, la zona se encoge hasta donde llegó, y desaparece cuando lo cruza entero. "Minimum %" fija el tamaño mínimo del hueco respecto al precio (1 % por defecto). Está pensado para velas diarias; en semanal o mensual los huecos son raros.
- **Perfil de volumen:** en el mismo menú, "Volume profile" muestra a la derecha del gráfico cuánto se negoció a cada precio en el tramo que estás viendo, y se recalcula al mover o acercar el gráfico. Cada fila separa el volumen de las velas alcistas y bajistas; las filas que reúnen el 70 % del volumen (el área de valor) se ven más intensas y una línea marca el precio con más volumen (POC). "Rows" elige en cuántas filas se reparte (24 por defecto). Se calcula con velas diarias, semanales o mensuales, así que es una aproximación.
- **Resultados:** una marca "E" en la parte de abajo del gráfico señala las cuatro últimas presentaciones de resultados (rellena) y la próxima (hueca), y la leyenda dice la fecha de la próxima (con `~` si Yahoo solo la estima) y el beneficio por acción que se espera ("EPS est.").
  - La "E" de una presentación pasada sale en verde si el beneficio por acción superó lo esperado y en rojo si no; gris si Yahoo no da la estimación. Al pasar el ratón por esa vela, la leyenda dice el real, el esperado y la sorpresa ("EPS 2.02 vs 1.89 est. (+6.88%)"). Yahoo solo da estas cifras de las cuatro últimas presentaciones. Las fechas vienen de Yahoo y se guardan 12 horas; los ETF y las divisas no tienen.
- **Dividendos:** una marca "D" en la misma franja que la "E" señala el día en que la acción empezó a cotizar sin el dividendo (la fecha ex-dividendo). Si cae en la misma vela que unos resultados, va encima. Al pasar el ratón por esa vela, la leyenda dice el importe por acción (por ejemplo "Dividend 0.26"); en semanal o mensual, el de esa semana o ese mes. Vienen de Yahoo con el histórico y ya están ajustados a los splits.
  - En el menú "Indicators", en "Marks", "Earnings marks" y "Dividend marks" muestran u ocultan cada tipo de marca (las dos están encendidas por defecto). Quitar las de resultados quita también la fecha de la próxima de la leyenda.
  - La IA conectada por MCP ve en `get_chart` los cuatro últimos dividendos y la rentabilidad de los últimos doce meses sobre el precio.

## Dibujos

- **Línea de tendencia:** elige la herramienta en la barra izquierda y haz clic en dos puntos, sobre el precio o sobre el RSI.
  - Clic en una línea para seleccionarla; arrastra un extremo o el cuerpo para moverla.
  - Con la línea seleccionada aparece una barra para cambiar el color (incluido el blanco), extenderla a la derecha o borrarla. Su botón "Line style" abre un panel con el grosor, el trazo (continuo, discontinuo o de puntos) y la opacidad. En una línea horizontal, el botón de la etiqueta muestra u oculta su precio en el eje.
  - En la misma barra, "Text" escribe un texto sobre la línea (por ejemplo "R1" o "soporte semanal"); se guarda al pulsar `Enter` o al salir del campo. En la horizontal va a la derecha, encima de la línea; en la de tendencia, encima de su punto medio.
  - doji recuerda el último aspecto que diste a cada tipo de dibujo: si dejas una horizontal blanca, discontinua y al 50 %, la siguiente horizontal sale igual.
  - `Supr` borra la línea seleccionada; `Esc` cancela una línea a medias o suelta la herramienta.
  - Una línea puede acabar más allá de la última vela. Ese tramo se cuenta en días de bolsa: sin fines de semana y, en acciones de EE. UU., sin los festivos de su bolsa.
- **Otras herramientas de dibujo**, en la misma barra izquierda. Se seleccionan, mueven, colorean y borran igual que una línea de tendencia.
  - La barra agrupa las herramientas: líneas (tendencia, horizontal, rayo horizontal y vertical), formas (canal, rectángulo y zona horizontal), texto y posiciones. Cada grupo enseña la herramienta que usaste la última vez o la que está armada; la pequeña esquina de su botón abre el menú con las demás.
  - "Horizontal line": un clic pone un nivel que cruza todo el gráfico, con su precio en el eje. Se arrastra arriba y abajo desde cualquier punto.
  - "Horizontal ray": un clic pone un nivel que empieza en ese día y sigue hacia la derecha. Se arrastra en precio y en fecha, y admite alerta (a partir de su día) y texto.
  - "Vertical line": un clic marca un día de arriba abajo; se arrastra a otro día.
  - "Horizontal zone": dos clics en dos precios; marca la banda entre ellos de lado a lado, por ejemplo un soporte como zona y no como línea. Cada borde se arrastra por su punto central y la zona entera desde cualquiera de sus bordes. Puede llevar texto.
  - "Text": un clic pone una nota en ese día y ese precio, con el texto "Text" listo para cambiarlo en el campo de su barra. Se arrastra desde cualquier punto de la nota.
  - Flecha: en el panel "Line style" de una línea de tendencia, "Arrow" le pone punta en su segundo extremo.
  - "Parallel channel": tres clics. Los dos primeros trazan la línea base y el tercero da el ancho. El punto central de la segunda línea cambia el ancho; cualquiera de las dos líneas mueve el canal entero.
  - "Rectangle": dos clics en esquinas opuestas. Cada esquina lo redimensiona y los lados lo mueven.
  - Canales y rectángulos solo se agarran por sus bordes: un clic dentro mueve el gráfico, no el dibujo.
- **Ojo, candado y lista de dibujos:** al pie de la barra izquierda, el ojo oculta o enseña todos los dibujos sin borrarlos (las alertas siguen armadas), el candado los fija para no moverlos ni seleccionarlos por accidente (se pueden seguir dibujando otros nuevos) y "Drawings list" abre la lista de los dibujos de la acción: tipo, nivel y texto, con un ojo para ocultar o enseñar cada uno y una `×` para borrarlo. La IA ve en `get_chart` cuáles están ocultos.
- **Herramienta de posición:** "Long position" y "Short position" en la barra izquierda. Un clic pone la entrada; el stop sale debajo (o encima, en corto) y el objetivo al doble de distancia. Pinta la zona de ganancia en verde y la de pérdida en rojo, con el precio y el % de cada una y la relación beneficio/riesgo (R:R).
  - Se arrastran por sus agarres: el objetivo, el stop (cada uno siempre en su lado de la entrada), la entrada (los niveles se quedan) y el borde derecho (la duración). Desde dentro de la caja se mueve entera.
  - Con la posición seleccionada, "Account" y "Risk %" calculan cuántas acciones comprar para arriesgar ese porcentaje de la cuenta si salta el stop.
  - La campana arma una alerta que avisa al tocar el objetivo o el stop, a partir del día de entrada.
- **Regla:** "Measure" en la barra izquierda (o `Alt+M`). Un clic marca el inicio y otro el final, o arrastra. Muestra el cambio de precio y en %, el número de velas y los días naturales. No se guarda: desaparece con el siguiente clic o con `Esc`.
- **Deshacer:** `Cmd+Z` (o `Ctrl+Z`) deshace el último cambio en los dibujos de la acción que estás viendo; con `Shift`, lo rehace. Un arrastre entero cuenta como un solo cambio.

## Alertas

- **Alertas:** con una línea de tendencia, una línea horizontal o una posición seleccionada, la campana de su barra arma una alerta; la línea queda marcada con un círculo. Cuando el precio la cruza, la alerta se desarma y doji avisa: en pantalla y con una notificación del Mac si hay una pestaña abierta (la primera vez el navegador pide permiso), y por Telegram si has enlazado un bot.
  - Las vigila el servidor de doji, no el navegador: saltan aunque no tengas ninguna pestaña abierta, mientras `npm start` siga en marcha y el ordenador encendido. Con el Mac dormido o apagado no hay alertas.
  - El servidor sigue los precios en vivo de las acciones con alertas armadas y además las comprueba cada 30 segundos con la última cotización.
  - **Telegram:** en "Settings", "Telegram alerts". Crea un bot con @BotFather en Telegram, pega su clave y pulsa "Connect"; luego escribe cualquier cosa a tu bot y pulsa "Link chat". "Send test message" comprueba que llegan. La clave se guarda en `data/telegram.json`, en tu ordenador, y no va en la configuración que exportas.
  - **Una vez, cada vez o hasta una fecha:** con la alerta armada, junto a la campana salen dos campos. "Once" (por defecto) la desarma al saltar; "Every cross" la deja armada y avisa cada vez que el precio cruce, como mucho una vez al día, para que no salte sin parar si el precio baila sobre el nivel. "Alert until" pone su último día (vacío, sin fin): pasado ese día, el servidor la desarma sin avisar.
  - **Historial:** la campana de la barra superior enseña, bajo las alertas de indicadores, las últimas 100 que han saltado (de líneas y de indicadores): fecha y hora, acción, qué cruzó y a qué precio. Un clic abre su gráfico y "Clear" lo vacía. Se guarda en `data/`, con el resto de la configuración.
  - Cuentan también los precios de pre y post mercado.
  - Una línea de tendencia que no se extiende a la derecha deja de avisar pasada su última fecha.
  - El nivel de una línea de tendencia se calcula contando días laborables entre sus extremos. En semanas con festivos puede quedar ligeramente por encima o por debajo de lo que se ve dibujado.
- **Alertas sobre indicadores:** la campana de la barra superior abre las alertas de la acción en pantalla que no van atadas a una línea: "RSI 14 crosses" un valor (30 por defecto), "Price crosses average" una de tus medias móviles, o "Day move beyond %" un porcentaje en el día (3 por defecto), hacia arriba o hacia abajo. La campana cuenta las armadas; cada una se arma o desarma con su casilla y se quita con la `×`.
  - Las vigila el servidor, como las de las líneas: con el precio del momento sobre la vela diaria que se está formando, avisan en pantalla y por Telegram y se desarman al saltar.

## Listas

- **Listas:** el nombre de la lista (arriba a la derecha) abre el desplegable para cambiar de lista, crear una nueva, renombrarla, duplicarla o borrarla (pide confirmación). Siempre queda al menos una.
- **Símbolos de la lista:** `+` abre el buscador para añadir a la lista activa; puedes añadir varios seguidos escribiendo el ticker y pulsando `Enter`, y cerrarlo con `Esc`. Añadir no cambia el gráfico. Pasa el ratón por una fila para quitarla; arrastra las filas para reordenar.
- **Secciones:** el botón que hay junto a `+` añade un separador con título dentro de la lista. Se arrastra como cualquier fila y, al pasar el ratón, se puede renombrar o quitar.
- **Icono de una lista:** en el desplegable de listas, el botón de la cara abre una paleta de 163 emojis por grupos (mercado, sectores, países, colores y señales, animales). También puedes escribir cualquier otro y pulsar `Enter` (en Mac, `⌃⌘Espacio` abre todos los emojis del sistema) o quitarlo con «No icon». El icono se ve delante del nombre.
- **Ordenar la lista:** pulsa la cabecera de una columna (Symbol, Last, Chg% o Ext) para ordenar de mayor a menor (de la A a la Z en Symbol); un segundo clic invierte el orden y el tercero vuelve a tu orden. Las secciones se respetan: se ordena dentro de cada una. Mientras hay un orden activo no se pueden arrastrar filas.
- **Banderas:** al pasar el ratón por la izquierda de una fila aparece una bandera; un clic abre seis colores (rojo, naranja, amarillo, verde, azul y morado) y "No flag" para quitarla. La bandera es de la acción, no de la lista: si marcas KO en una lista, sale marcada en todas.
  - La bandera pequeña de la cabecera, a la izquierda de "Symbol", ordena por bandera en el orden de la paleta; las acciones sin bandera van al final.
  - En el menú de las columnas, "Only flagged symbols" enseña solo las acciones con bandera (y las secciones que tienen alguna). Mientras está activo no se pueden arrastrar filas.
  - La IA conectada por MCP ve la bandera de cada acción en `get_watchlists` y en `scan_watchlist`.
- **Columnas a elegir:** el botón de las columnas, en la cabecera de la lista, añade hasta cinco columnas más, todas apagadas por defecto: "RSI 14" (RSI) diario, "From 52-week high" (52W Hi, cuánto está el precio por debajo del máximo de las últimas 52 semanas), "Volume vs average" (Rel Vol, el volumen de hoy frente a su media de 20 días), "Next earnings" (Earn, la próxima fecha de resultados, con `~` si es estimada) y "Nearest level" (Level, la distancia al soporte o la resistencia más cercanos; al pasar el ratón dice cuál y a qué precio).
  - Se ordenan con un clic en su cabecera, como las demás. Los resultados y el nivel más cercano empiezan por el más próximo; el resto, por el más alto.
  - Cada columna ensancha la lista 64 px al encenderla (y la estrecha al apagarla); con columnas extra la lista puede pasar de 640 px, 64 px más por columna.
  - Salen del histórico diario de cada acción, que el servidor guarda en `data/cache/`. La primera vez, las acciones que aún no tiene se descargan de dos en dos y sus celdas muestran un guion hasta que llegan; luego se refrescan cada cinco minutos. Las fechas de resultados son las del calendario.
- **Filtros guardados:** el botón "Filter", encima de las columnas, abre los filtros guardados y "New filter…". Un filtro es una o varias condiciones que deben cumplirse todas: el cambio del día, el RSI 14, la distancia al máximo de 52 semanas, el volumen frente a su media, la distancia al nivel más cercano (sin signo), la distancia a la SMA 50 o a la SMA 200 (en %, positiva si el precio está por encima) y los días hasta los próximos resultados, cada una por encima o por debajo de un valor. Por ejemplo: RSI 14 por debajo de 30 y vs SMA 200 por encima de 0.
  - Se guarda con un nombre y se aplica a la lista activa ("This watchlist") o a todas a la vez ("All watchlists"). Es una vista: la lista no cambia. Junto al nombre se ve cuántas acciones lo cumplen ("12 of 35").
  - Mientras hay un filtro no se pueden arrastrar filas; con "All watchlists" tampoco se pueden quitar, porque cada fila puede ser de otra lista.
  - "Edit filter" lo cambia o lo borra, "Save as list" crea una lista nueva con las acciones que lo cumplen y la abre, y la `×` lo quita.
  - Los valores son los de las columnas, sacados del histórico diario: el cambio del día es el de la última vela guardada, no el del precio en vivo. Con todas las listas a la vez el servidor los refresca cada media hora (cada cinco minutos con hasta 60 acciones) y guarda solo los valores, no los históricos, para no llenar la memoria.
- **Ancho de la lista:** arrastra el borde izquierdo de la lista para ensancharla o estrecharla; el gráfico ocupa el resto. Va de 220 a 640 px (400 por defecto, y 64 px más por cada columna extra) y se guarda con el resto de la configuración. Las columnas se adaptan para que los tickers se lean enteros: por debajo de 381 px se oculta "Ext" y por debajo de 300 px también "Last".
- **Horas extendidas:** la columna "Ext" muestra, en porcentaje, cuánto se separa del cierre el último precio fuera del horario normal, en verde o rojo; al pasar el ratón se ve el precio. Un punto junto al ticker indica la sesión: naranja en el pre-mercado y azul en el post-mercado. Durante la sesión normal, y en lo que no cotiza fuera de horario (índices, cripto, bolsas europeas), muestra un guion. Con el mercado cerrado se queda el último dato del post-mercado hasta que abre el siguiente pre-mercado.
- **Importar y exportar listas:** en el desplegable de listas, "Import list…" lee un archivo exportado de TradingView (`.txt`, con los símbolos como `NASDAQ:AAPL` y las secciones como `###Nombre`) o un CSV (una columna con los símbolos, con o sin cabecera, y si quieres otra con la sección; si hay cabecera, se buscan las columnas "Symbol" y "Section"; vale `,` o `;`). Cada símbolo se traduce al de Yahoo (en las bolsas de EE. UU. basta con quitar el prefijo; en las demás se añade su sufijo, como `.MC` en Madrid o `.DE` en Xetra; Euronext prueba París, Ámsterdam, Bruselas, Lisboa y Dublín; los pares de divisas, las criptomonedas, los futuros continuos `1!` y los índices más comunes tienen su propia traducción), se comprueba contra Yahoo y se crea una lista nueva con el nombre del archivo. Al terminar dice cuántos entraron y cuáles no se encontraron. "Export as CSV" guarda la lista activa con símbolo, nombre, bolsa y sección, y "Export for TradingView" en el formato que TradingView importa.
- **Panel de posición:** el panel "Position", encima de las notas, guarda cuántas acciones tienes ("Shares") y a qué precio medio ("Average price") de la acción en pantalla; se guarda al pulsar `Enter` o al salir del campo, y "Remove position" la quita. Plegado, dice la ganancia en % y en dinero.
  - En el gráfico, una línea discontinua en el precio medio, verde o roja según vayas ganando o perdiendo, con la ganancia junto a su precio en el eje. No sale en el modo repetición.
  - En el menú de las columnas, "Position gain %" (P/L %) y "Position gain" (P/L) la enseñan en la lista, y abajo sale el total de las acciones que se ven, uno por moneda (la moneda es la que da Yahoo para cada acción; no se convierte).
  - Son datos tuyos: se guardan en `data/state.json`, en tu ordenador. La IA conectada por MCP no los ve salvo que actives "Share positions with the AI" en "Settings"; entonces `get_chart` da la posición y `scan_watchlist` su ganancia.

## Paneles y calendario

- **Notas:** el panel "Notes", debajo de la lista, guarda un texto por acción (tesis, precio de entrada, plan). Un punto azul avisa de que la acción tiene nota aunque el panel esté plegado.
- **Ficha de la empresa:** el panel "Company", entre la posición y las notas, enseña de la acción en pantalla la capitalización (o el patrimonio, en los fondos), el PER y el PER esperado, la rentabilidad por dividendo, el rango de 52 semanas, el sector y la industria (o la categoría del fondo), la próxima fecha de resultados, la beta, los empleados, el país, una descripción corta y su web. Lo que Yahoo no da no sale; las divisas e índices casi no tienen ficha.
  - Solo se pide al abrir el panel. Se guarda un día en `data/cache/profiles.json`, con la misma sesión de Yahoo que las fechas de resultados.
- **Noticias:** el panel "News", encima de las notas, lista los últimos titulares de la acción en pantalla, del más nuevo al más viejo, con el medio y hace cuánto salieron. Un clic abre la noticia en otra pestaña. Solo titulares y enlace: doji no copia el texto. Vienen del buscador de Yahoo, solo se piden al abrir el panel y se guardan 15 minutos en memoria.
- **Calendario de resultados:** el botón del calendario, arriba a la derecha, abre una semana de lunes a viernes con las empresas de tus listas que presentan resultados cada día. Los fines de semana solo salen si alguien presenta. ☀ es antes de la apertura, ☾ tras el cierre y `~` una fecha que Yahoo solo estima; las ya pasadas se ven más tenues. Las flechas cambian de semana, "This week" vuelve a la actual y "Show" filtra por lista. Un clic en una empresa abre su gráfico.
  - Las fechas se guardan en `data/cache/earnings.json` y se refrescan cada 12 horas. La primera vez tardan uno o dos minutos en llegar todas; mientras, el calendario dice cuántas faltan.
  - Abajo, "Warn in the watchlist…" pone una marca `E 3d` en las filas de la lista activa cuyas empresas presentan en 7 días o menos (`E` si es hoy). Está apagado por defecto.
  - La IA conectada por MCP tiene `get_earnings_calendar`: qué presenta entre dos fechas, en todas las listas o en una.

## Configuración

- **Configuración:** el menú "Settings" exporta todo (listas, líneas, indicadores, tema y ajustes del gráfico) a un archivo `doji-config-AAAA-MM-DD.json` y lo vuelve a importar. Importar reemplaza la configuración actual entera, por eso pide confirmación.
- **Fuente de reserva:** en "Settings", "Backup data" guarda una clave gratuita de Twelve Data (twelvedata.com). Si Yahoo falla tres veces seguidas al pedir un histórico, doji pide a Twelve Data el histórico diario y el gráfico lo avisa ("Data from Twelve Data: Yahoo is not answering"); en cuanto Yahoo responde, vuelve a él. Lo que da Twelve Data se guarda 15 minutos aparte y nunca se mezcla con la caché de Yahoo.
  - En esta primera versión cubre acciones y ETF de EE. UU., criptomonedas y divisas; las de otras bolsas, índices y futuros siguen solo con Yahoo. Los precios en vivo, el buscador, los resultados y la ficha siguen dependiendo de Yahoo. Sus históricos no traen splits ni dividendos.
  - La clave se guarda en `data/backup.json`, en tu ordenador, y no sale en la configuración que exportas. Stooq, la opción sin clave, ahora pide verificar un navegador y no se usa.

## Guardar en Google Drive

Es opcional: sin iniciar sesión, doji funciona como siempre y no manda nada a Google. Si entras con tu cuenta, doji guarda una copia de tu configuración en tu propio Google Drive, para que no se pierda y te siga a cualquier ordenador donde abras doji. No hay ningún servidor nuestro: doji habla con tu Drive desde tu ordenador. La sección "Google Drive" de "Settings" solo sale si tu copia de doji tiene un [cliente de Google](#crear-el-cliente-de-google-quien-publica-doji).

- **Iniciar sesión:** en "Settings", "Google Drive", "Sign in with Google". La página de Google se abre en otra pestaña; si el navegador la bloquea, usa "Open the Google page". El enlace vale diez minutos; si cerraste la página sin terminar, "Start again" abre otra. Google te pide permiso solo para los archivos que crea doji: no ve el resto de tu Drive. Al terminar, cierra esa pestaña y vuelve a doji.
- **Dónde queda la copia:** en el archivo `state.json` de una carpeta `doji` en "Mi unidad". Lleva lo mismo que `data/state.json`: listas, dibujos, alertas, notas y posiciones. No se suben las claves de Telegram ni de Twelve Data, ni `data/cache/`, ni tu sesión de Google.
- **Cuándo se sincroniza:** al arrancar, al iniciar sesión, cada cinco minutos, cada minuto mientras tengas doji a la vista y al pulsar "Sync now", doji mira lo que hay en Drive y trae la copia si es más nueva. También mira antes de guardar un cambio, si hace más de un minuto que no mira Drive (por ejemplo, al despertar el ordenador), para no subir una configuración atrasada. Ese guardado espera a Drive cinco segundos como mucho; si Drive no responde a tiempo, durante el minuto siguiente los cambios se guardan sin esperar. Cada cambio (hecho en la app, por tu IA o por una alerta que salta) se sube unos segundos después. "Settings" dice con qué cuenta has entrado y cuándo fue la última sincronización.
- **La primera vez:** si este ordenador aún no tiene configuración, usa la de Drive sin preguntar. Si las dos existen y son distintas, doji pregunta con cuál quedarse ("Keep this computer's" o "Use Google Drive's") y enseña las listas, los símbolos, los dibujos y la fecha de cada una. Hasta que contestes no sube ni cambia nada. La copia que no elijas se guarda antes en `data/state.json.bak-…`. Si cuando contestas doji ya ha visto que la de Drive cambió, la respuesta no se aplica y vuelve a preguntar con los datos nuevos. Si aún no lo ha visto, "Keep this computer's" mira Drive antes de subir, así que también vuelve a preguntar; "Use Google Drive's", en cambio, usa la copia que enseñaba y la más nueva llega en la siguiente comprobación, salvo que antes hagas aquí otro cambio sin que haya pasado un minuto desde que doji miró Drive por última vez: entonces gana ese cambio.
- **Dos ordenadores:** gana el último cambio. Cuando la copia de Drive sustituye a la de este ordenador, doji guarda antes la de aquí en `data/state.json.bak-…` y la barra de arriba avisa ("Your settings were replaced by the copy in Google Drive."), también al abrir doji en el navegador si el cambio llegó mientras no lo mirabas y doji ha seguido en marcha desde entonces. Cuando gana la de este ordenador, la anterior queda en Drive, en el historial de versiones del archivo ("Gestionar versiones"), que Drive conserva por un tiempo limitado (en general, 30 días o 100 versiones). Si un cambio no se puede guardar porque Drive tenía una copia más nueva, la pestaña se recarga con la de Drive y el aviso dice además que ese último cambio no se guardó ("Replaced by Google Drive. Last change not saved."). Si una alerta salta justo cuando llega una copia de Drive en la que ya no está armada (o, si se repite, en la que ya saltó ese día), no se avisa.
- **Sin conexión:** todo sigue funcionando y se guarda en tu ordenador. "Settings" lo dice y doji lo vuelve a intentar: a los 30 segundos y luego cada vez más espaciado, hasta cada cinco minutos.
- **Cerrar sesión:** "Sign out" borra `data/google.json` y pide a Google que retire el permiso. El archivo se queda en tu Drive; si no lo quieres, bórralo desde Drive. Cuando Google retira el permiso, doji lo pierde en toda tu cuenta: tus otros ordenadores dirán que la sesión ha caducado y habrá que volver a entrar en ellos. Conservan su configuración y, al entrar con la misma cuenta, siguen sin preguntar nada. Si en ese momento no hay conexión o Google no responde, la sesión se borra igualmente de este ordenador, pero el permiso sigue concedido y doji no lo avisa; para comprobarlo o quitarlo, entra en las [conexiones de tu cuenta de Google](https://myaccount.google.com/connections).
- **Sesión caducada:** si Google deja de aceptar la sesión (por ejemplo, porque has cerrado sesión en otro ordenador o has quitado el permiso en tu cuenta de Google), "Settings" lo dice; entra otra vez con "Sign in with Google".

### Crear el cliente de Google (quien publica doji)

Quien publica doji crea una sola vez el "cliente" con el que la app pide permiso a Google. Quien usa esa copia no tiene que hacer nada de esto: cada persona entra con su cuenta y sus datos van a su Drive.

1. En <https://console.cloud.google.com>, crea un proyecto (por ejemplo, `doji`).
2. "APIs y servicios" → "Biblioteca" → "Google Drive API" → "Habilitar".
3. En "Google Auth Platform" (la pantalla de consentimiento de OAuth):
   - Tipo de usuario "Externo", nombre de la aplicación `doji` y los correos de asistencia y de contacto.
   - En "Acceso a los datos", añade solo `https://www.googleapis.com/auth/drive.file`.
   - En "Público", "Publicar aplicación", para dejarla "En producción". Es importante: en modo de prueba las sesiones caducan a los 7 días y solo pueden entrar los usuarios de prueba que añadas (hasta 100). `drive.file` no es un permiso sensible, así que no hay que pasar su verificación; Google solo pide verificar la marca si pones un logo.
4. "Clientes" → "Crear cliente" → tipo "App de escritorio". Copia el ID y el secreto del cliente.
5. Pégalos en `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`, en `server/googleClient.ts`, o arranca doji con las variables `DOJI_GOOGLE_CLIENT_ID` y `DOJI_GOOGLE_CLIENT_SECRET`. Google no trata como secreto el de una app de escritorio, así que puede ir en el código.

Para probar sin Google, `DOJI_GOOGLE_API=http://127.0.0.1:<puerto>` hace que doji hable con un Google falso en ese puerto (con cualquier ID y secreto).

## Atajos

- **Atajos:** las flechas arriba y abajo recorren la lista. `Alt+T` arma la línea de tendencia, `Alt+H` la horizontal, `Alt+C` el canal, `Alt+R` el rectángulo y `Alt+M` la regla; `Esc` vuelve al cursor. `Alt+W` pliega o despliega la lista. `?` abre un cuadro con todos los atajos, al que también se llega desde "Settings", con "Keyboard shortcuts".

## Conectar tu IA (MCP)

doji trae un servidor [MCP](https://modelcontextprotocol.io) para que la aplicación de IA que uses (Claude, ChatGPT, Gemini, Copilot…) lea tus gráficos y trabaje sobre ellos con tu propia suscripción. doji no llama a ninguna IA ni necesita claves.

Herramientas que ofrece:

| Herramienta | Qué hace |
|---|---|
| `get_watchlists` | Tus listas, con sus secciones, cuál está activa y qué hay en pantalla. |
| `scan_watchlist` | Revisa una lista entera: precio, cambio, RSI, distancia a las SMA 50 y 200, rango de 52 semanas y distancia a su máximo, MACD, volumen, alertas, notas y distancia a los niveles más cercanos. |
| `get_chart` | Resumen de un gráfico con indicadores calculados por doji, máximos y mínimos recientes, últimas velas, tus dibujos y tu nota. |
| `get_earnings_calendar` | Quién presenta resultados entre dos fechas, en todas tus listas o en una, con la hora (antes de abrir o tras el cierre) si se sabe. |
| `get_news` | Los últimos titulares de una acción, con su medio, la hora y el enlace. |
| `get_company_profile` | La ficha de una empresa o fondo: capitalización (o patrimonio), PER, rentabilidad por dividendo, beta, rango de 52 semanas, sector o categoría, país, empleados, web y descripción. |
| `get_earnings` | Las últimas fechas de resultados de una acción y la próxima (también van dentro de `get_chart`). |
| `add_horizontal_line` | Dibuja una línea horizontal, con alerta si se pide. |
| `add_trend_line` | Dibuja una línea de tendencia entre dos puntos (día y precio), extendida a la derecha si se pide, con alerta y texto opcionales. |
| `set_alert` | Arma o desarma la alerta de una línea existente. |
| `update_drawing` | Mueve o cambia un dibujo: el precio de una horizontal, los puntos de una tendencia, canal o rectángulo, si se extiende, su color, grosor, trazo, opacidad o texto. |
| `delete_drawing` | Borra un dibujo, pero solo los que hizo una IA (`get_chart` los marca con `madeByAi`); los tuyos no. Va marcada como destructiva; que pida confirmación antes de usarla depende de la aplicación de IA y de sus permisos. |
| `write_note` | Escribe en la nota de una acción. |
| `create_watchlist` | Crea una lista, con sus símbolos si se le dan, sin cambiar la que tienes en pantalla. |
| `add_to_watchlist` | Añade símbolos a una lista, al final o dentro de una de sus secciones. |
| `add_section` | Añade una sección a una lista. |
| `remove_from_watchlist` | Quita símbolos de una lista; sus dibujos, alertas y notas se quedan. |
| `rename_watchlist` | Cambia el nombre de una lista. |
| `set_watchlist_icon` | Pone o quita el emoji de una lista (`create_watchlist` también acepta uno). |

La IA no puede borrar listas enteras ni tus dibujos; solo borra los dibujos que hizo ella. Sí puede quitar símbolos de una lista (`remove_from_watchlist`) y `write_note` en modo `replace` sustituye la nota entera; las aplicaciones de IA suelen pedir confirmación antes de usar herramientas marcadas como destructivas. Lo que añade aparece en doji en unos segundos, sin recargar; las alertas saltan mientras el servidor de doji esté en marcha, aunque no haya ninguna pestaña abierta.

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

- `data/state.json`: listas de seguimiento, líneas, tema e indicadores. Es el archivo que conviene copiar si quieres una copia de seguridad. "Export settings" te da esa misma copia desde la app, y sirve para llevar tu configuración a otro ordenador sin [guardarla en Google Drive](#guardar-en-google-drive). Se puede importar tanto un archivo exportado como una copia de `state.json`.
- `data/state.json.bak-AAAA-MM-DD`: copia automática del estado tal como estaba antes del primer cambio de cada día. Se conservan las siete últimas. Cada vez que la copia de Google Drive sustituye a la de este ordenador se guarda otra; si ese día ya hay una, su nombre lleva además la hora (`…-HHMMSS`). Si al entrar en Google Drive eliges quedarte con la copia de este ordenador, la de Drive se guarda aquí también con la hora. De estas, con la hora, se conservan las diez últimas, aparte de las diarias.
- `data/google.json`: tu sesión de Google, si guardas la configuración en Drive. Solo se envía a Google y nunca se sube. "Sign out" lo borra.
- `data/state.json.corrupt-…`: si alguna vez el archivo no se puede leer como JSON, se guarda aparte con este nombre y la app arranca con valores por defecto. Si guardas la configuración en Drive, doji no sube esos valores: trae la copia de Drive, o pregunta con cuál quedarte si antes de poder mirar Drive ya habías guardado algún cambio. Hace lo mismo con un archivo que solo contenga `{}`.
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
- Con doji en marcha en dos ordenadores a la vez, los dos vigilan las mismas alertas y cada aviso llega dos veces a Telegram.
- En Google Drive, doji solo ve lo que él crea: una carpeta `doji` hecha a mano no la usa y crea la suya.
- No se admiten copias de más de 5 MB en Google Drive.
- Usa la misma versión de doji en todos tus ordenadores: al subir la configuración, una versión antigua pierde lo que no conoce.
- En Google Drive gana el último cambio sobre la configuración entera, sin mezclar campo a campo: de los cambios hechos en dos ordenadores en el mismo minuto, sin conexión, o mientras Google tarda más de unos segundos en responder o falla (y hasta un minuto después), solo queda el más reciente. El otro se queda en una copia `bak` de su ordenador y, si llegó a subirse, en las versiones de Drive.
- Después de cerrar sesión y volver a entrar, puede que Google no deje a doji ver la carpeta anterior; entonces crea una nueva.

## Prueba completa en Chrome

`npm run smoke` recorre la app entera en Chrome y guarda una captura de cada paso. Dibuja y borra líneas y cambia el tema y la lista: ejecútala contra una carpeta de datos de prueba (`DOJI_DATA_DIR`), no contra la tuya. Arranca esa app con `DOJI_TEST_HOOKS=1` (activa `PUT /api/test/prices`, que da precios inventados al vigilante de alertas, y `PUT /api/test/yahoo`, que simula que Yahoo no responde), `DOJI_TELEGRAM_API=http://127.0.0.1:4799` y `DOJI_TWELVE_API=http://127.0.0.1:4799` (la prueba levanta ahí un Telegram y un Twelve Data falsos):

```bash
DOJI_TEST_HOOKS=1 DOJI_TELEGRAM_API=http://127.0.0.1:4799 DOJI_TWELVE_API=http://127.0.0.1:4799 DOJI_DATA_DIR=/tmp/doji-prueba PORT=4781 npm start
npm run smoke -- http://127.0.0.1:4781 /tmp/capturas
```
