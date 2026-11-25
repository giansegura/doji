<img src="public/favicon.svg" width="56" height="56" alt="doji" />

# doji

Gráficos de bolsa que corren en tu ordenador. Sin cuentas, sin suscripciones y sin mandar tus listas a ningún sitio.

Tiene listas de seguimiento, indicadores, dibujos y alertas que te llegan a Telegram aunque no tengas el navegador abierto. Además, tu aplicación de IA puede leer tus gráficos y trabajar sobre ellos.

La interfaz está en inglés.

## Empezar

Necesitas Node 22.

```bash
npm install
npm start
```

Abre <http://127.0.0.1:4780>. Para usar otro puerto: `PORT=4790 npm start`.

## Qué hace

- **Gráficos.** Acciones, ETF, divisas, criptomonedas, índices y futuros, en velas diarias, semanales o mensuales. Precios en vivo, vista en euros, dos gráficos lado a lado, tres temas y modo repetición para practicar sobre el pasado.
- **Indicadores.** Volumen, RSI, MACD, Bollinger y medias móviles. También soportes y resistencias automáticos, perfil de volumen, patrones de velas, huecos sin cerrar y divergencias del RSI. Marca resultados y dividendos sobre el gráfico.
- **Dibujos.** Líneas de tendencia, horizontales y verticales, canales, rectángulos, zonas, texto, posiciones largas y cortas, y una regla. `Cmd+Z` deshace.
- **Alertas.** Sobre líneas, posiciones e indicadores. Las vigila el servidor, así que llegan por Telegram aunque no haya ninguna pestaña abierta. Con la app abierta, avisan también en pantalla y con una notificación del Mac.
- **Listas.** Varias listas con secciones, banderas, columnas extra (RSI, distancia al máximo, próximos resultados…), filtros guardados y tus posiciones con su ganancia. Se importan y exportan en CSV o en el formato de TradingView.
- **Contexto.** Ficha de la empresa, noticias, calendario de resultados y una nota por acción.

Pulsa `?` para ver todos los atajos. Con el gráfico delante, escribir una letra abre el buscador.

El detalle de cada función está en la [guía](docs/guia.md).

## Conectar tu IA

doji incluye un servidor [MCP](https://modelcontextprotocol.io). Con él, tu aplicación de IA (Claude, ChatGPT, Copilot…) puede leer tus listas y gráficos, dibujar líneas, poner alertas y escribir notas, todo con tu propia suscripción. doji no llama a ninguna IA ni necesita claves.

Con doji en marcha, registra este comando en tu aplicación. Cambia `<doji>` por la ruta de la carpeta:

```bash
claude mcp add --scope user doji -- <doji>/node_modules/.bin/tsx <doji>/mcp/index.ts
```

La IA no puede borrar listas ni los dibujos que hiciste tú, y no ve tus posiciones salvo que lo actives en "Settings". La configuración para otras aplicaciones y la lista de herramientas están en la [guía](docs/guia.md#conectar-tu-ia-mcp).

## Tus datos

Todo se queda en la carpeta `data/`, que no se versiona:

| Archivo | Qué guarda |
|---|---|
| `data/state.json` | Tu configuración: listas, dibujos, alertas, notas y posiciones. Es lo que hay que copiar para tener una copia de seguridad. |
| `data/state.json.bak-*` | Copias automáticas, una por día, de los últimos siete días. |
| `data/telegram.json`, `data/backup.json` | Las claves de Telegram y de Twelve Data. Nunca salen de tu ordenador. |
| `data/cache/` | Históricos y logos descargados. Se puede borrar sin perder nada. |

"Export settings", en "Settings", hace la misma copia desde la app. Para usar otra carpeta: `DOJI_DATA_DIR=/otra/carpeta npm start`.

## De dónde salen los precios

De los endpoints públicos de Yahoo Finance. No es una API oficial: puede cambiar o fallar sin aviso. Las bolsas europeas llegan con 15 minutos de retraso.

Si Yahoo deja de responder, doji enseña el último histórico guardado. Si además pones una clave gratuita de Twelve Data en "Settings", "Backup data", pide ahí los históricos diarios hasta que Yahoo vuelva.

## Desarrollo

```bash
npm run dev     # servidor y Vite con recarga en caliente (http://127.0.0.1:5173)
npm test        # tests
npm run smoke   # prueba completa en Chrome (ver la guía antes de usarla)
```

| Carpeta | Qué hay |
|---|---|
| `src/` | La app (React). |
| `server/` | El servidor local: API, caché, alertas y fuentes de datos (`server/provider/`). |
| `shared/` | Lógica que usan los dos lados: indicadores, alertas, fechas, tipos. |
| `mcp/` | El servidor MCP. |
| `scripts/` | La prueba completa en Chrome. |

Cada cambio entra por un pull request, nunca directo a `main`:

- El título sigue [Conventional Commits](https://www.conventionalcommits.org/), en inglés: `feat: add market ticker`.
- Se fusiona siempre con squash.
- Antes tienen que pasar `tests`, `build` y `conventional-title`. CodeRabbit revisa cada pull request.

## Avisos

- Proyecto personal, sin relación con TradingView ni con Yahoo. Nada de lo que muestra es una recomendación de inversión.
- El gráfico usa [Lightweight Charts](https://github.com/tradingview/lightweight-charts) (Apache 2.0); el logo de la esquina es la atribución que pide su licencia. TradingView Lightweight Charts™, Copyright (c) 2026 TradingView, Inc. <https://www.tradingview.com/>
- Este repositorio no contiene precios, históricos ni logos. La app los pide desde tu ordenador para tu propio uso; pertenecen a sus dueños y su uso depende de las condiciones de cada servicio.

## Licencia

[MIT](LICENSE). Las dependencias conservan cada una la suya.
