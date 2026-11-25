import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { mkdir, readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright-core'
import { dayInZone, mondayOf } from '../shared/dates'
import { sessionDayOf, tradesOnWeekends } from '../shared/indicatorAlerts'
import { symbolsOf } from '../shared/listItems'
import { findOpenGaps } from '../src/domain/gaps'
import type { AppState, Drawing, History, LiveTick, Quote, ThemeName, TrendLine } from '../shared/types'

type Box = { x: number; y: number; width: number; height: number }

const [url, outDir] = process.argv.slice(2)

if (!url || !outDir) {
  console.error('Uso: npm run smoke -- <url> <carpetaSalida>')
  process.exit(1)
}

await mkdir(outDir, { recursive: true })

const FAKE_TELEGRAM_PORT = 4799
const FAKE_BOT = 'doji_test_bot'
const FAKE_CHAT = 4242
const telegramMessages: { chat: unknown; text: unknown }[] = []
const fakeTelegram = createServer((req, res) => {
  const chunks: Buffer[] = []
  req.on('data', (chunk: Buffer) => chunks.push(chunk))
  req.on('end', () => {
    const reply = (body: unknown) => {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(body))
    }
    if (req.url?.startsWith('/time_series')) {
      const values = Array.from({ length: 30 }, (_, index) => {
        const day = new Date(Date.UTC(2026, 9, 1 + index)).toISOString().slice(0, 10)
        const close = 100 + index
        return { datetime: day, open: String(close - 1), high: String(close + 1), low: String(close - 2), close: String(close), volume: '1000' }
      })
      return reply({ meta: { currency: 'USD', exchange: 'NYSE' }, values, status: 'ok' })
    }
    if (req.url?.endsWith('/getMe')) return reply({ ok: true, result: { username: FAKE_BOT } })
    if (req.url?.endsWith('/getUpdates')) return reply({ ok: true, result: [{ update_id: 1, message: { chat: { id: FAKE_CHAT }, text: '/start' } }] })
    if (req.url?.endsWith('/sendMessage')) {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as { chat_id?: unknown; text?: unknown }
      telegramMessages.push({ chat: body.chat_id, text: body.text })
      return reply({ ok: true, result: {} })
    }
    res.writeHead(404)
    res.end()
  })
})
await new Promise<void>((done) => fakeTelegram.listen(FAKE_TELEGRAM_PORT, '127.0.0.1', done))

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const QUIET_STREAM = 'retry: 600000\n\n'
let streamBody = QUIET_STREAM
await context.route('**/api/stream*', (route) =>
  route.fulfill({ status: 200, contentType: 'text/event-stream; charset=utf-8', body: streamBody }),
)
const frozenPrices = new Map<string, { status: number; body: Buffer; contentType: string }>()
await context.route(/\/api\/(quotes|history)\?/, async (route) => {
  const known = frozenPrices.get(route.request().url())
  if (known) return route.fulfill({ status: known.status, body: known.body, contentType: known.contentType })
  const response = await route.fetch()
  const answer = { status: response.status(), body: await response.body(), contentType: response.headers()['content-type'] ?? 'application/json' }
  if (response.ok()) frozenPrices.set(route.request().url(), answer)
  return route.fulfill(answer)
})
const page = await context.newPage()
const pageErrors: string[] = []
let stepNumber = 0

page.on('pageerror', (error) => pageErrors.push(`[paso ${stepNumber}] ${error.message}`))
page.on('console', (message) => {
  const expectedConflict = message.text().includes('409 (Conflict)') && message.location().url.endsWith('/api/state')
  const missingLogo = message.text().includes('404 (Not Found)') && message.location().url.includes('/api/logo?')
  if (message.type() === 'error' && !expectedConflict && !missingLogo) {
    pageErrors.push(`[paso ${stepNumber}] ${message.text()} ${message.location().url}`)
  }
})

const check = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message)
}

const shot = (label: string) => page.screenshot({ path: join(outDir, `${label.replace(/[^a-z0-9]+/gi, '-')}.png`) })

const step = async (name: string, run: () => Promise<void>): Promise<void> => {
  stepNumber += 1
  const label = `${String(stepNumber).padStart(2, '0')} ${name}`
  try {
    await run()
    await page.waitForTimeout(300)
    await shot(label)
    console.log(`ok     ${label}`)
  } catch (error) {
    await shot(`${label} FALLO`)
    console.error(`FALLO  ${label}: ${error instanceof Error ? error.message : String(error)}`)
    await browser.close()
fakeTelegram.close()
    process.exit(1)
  }
}

const savedState = async (): Promise<AppState> => {
  await page.waitForTimeout(800)
  return (await fetch(`${url}/api/state`)).json() as Promise<AppState>
}

const activeItems = (state: AppState) =>
  symbolsOf((state.watchlists.find((list) => list.id === state.activeWatchlistId) ?? state.watchlists[0]).items)

const drawingsOf = async (symbol: string): Promise<Drawing[]> => (await savedState()).lines[symbol] ?? []

const linesOf = async (symbol: string): Promise<TrendLine[]> =>
  (await drawingsOf(symbol)).filter((drawing): drawing is TrendLine => drawing.kind === undefined)

const panes = async (): Promise<{ price: Box; rsi: Box }> => {
  const rows = await page.locator('.tv-lightweight-charts tr').all()
  const boxes = (await Promise.all(rows.map((row) => row.boundingBox())))
    .filter((box): box is Box => box !== null)
    .sort((a, b) => b.height - a.height)
  check(boxes.length >= 2, 'no se encontraron los dos paneles del gráfico')
  return { price: boxes[0], rsi: boxes[1] }
}

const at = (box: Box, fx: number, fy: number): [number, number] => [box.x + box.width * fx, box.y + box.height * fy]

const button = (name: string | RegExp) => page.getByRole('button', { name, exact: typeof name === 'string' })

const TOOL_MENUS: Record<string, string> = {
  'Trend line': 'More line tools',
  'Horizontal line': 'More line tools',
  'Horizontal ray': 'More line tools',
  'Vertical line': 'More line tools',
  'Parallel channel': 'More shapes',
  Rectangle: 'More shapes',
  'Horizontal zone': 'More shapes',
  'Long position': 'More position tools',
  'Short position': 'More position tools',
}

const pickTool = async (name: string): Promise<void> => {
  const direct = button(name)
  if ((await direct.count()) > 0) return direct.click()
  await button(TOOL_MENUS[name]).click()
  await page.getByRole('menuitem', { name, exact: true }).click()
}

const row = (symbol: string) => page.getByRole('listitem').getByRole('button', { name: new RegExp(`^${symbol}\\b`) })

const drawLine = async (box: Box, from: [number, number], to: [number, number]): Promise<void> => {
  await pickTool('Trend line')
  await page.mouse.click(...at(box, ...from))
  await page.mouse.move(...at(box, (from[0] + to[0]) / 2, (from[1] + to[1]) / 2), { steps: 5 })
  await page.mouse.click(...at(box, ...to))
}

const bluePixelNear = (x: number, y: number): Promise<boolean> =>
  page.evaluate(
    ([px, py]) => {
      const radius = 7
      return [...document.querySelectorAll('.tv-lightweight-charts canvas')].some((element) => {
        const canvas = element as HTMLCanvasElement
        const rect = canvas.getBoundingClientRect()
        const scale = canvas.width / rect.width
        const left = Math.round((px - rect.left - radius) * scale)
        const top = Math.round((py - rect.top - radius) * scale)
        const size = Math.round(radius * 2 * scale)
        if (left < 0 || top < 0 || left + size > canvas.width || top + size > canvas.height) return false
        const pixels = canvas.getContext('2d')?.getImageData(left, top, size, size).data
        if (!pixels) return false
        for (let index = 0; index < pixels.length; index += 4) {
          if (pixels[index] < 90 && pixels[index + 1] > 60 && pixels[index + 1] < 140 && pixels[index + 2] > 200 && pixels[index + 3] > 200) {
            return true
          }
        }
        return false
      })
    },
    [x, y],
  )

const blueCentre = (box: Box): Promise<[number, number] | null> =>
  page.evaluate(({ x, y, width, height }) => {
    const found: [number, number][] = []
    document.querySelectorAll('.tv-lightweight-charts canvas').forEach((element) => {
      const canvas = element as HTMLCanvasElement
      const rect = canvas.getBoundingClientRect()
      const scale = canvas.width / rect.width
      const left = Math.max(x, rect.left)
      const top = Math.max(y, rect.top)
      const right = Math.min(x + width, rect.right)
      const bottom = Math.min(y + height, rect.bottom)
      if (right - left < 1 || bottom - top < 1) return
      const columns = Math.floor((right - left) * scale)
      const rows = Math.floor((bottom - top) * scale)
      const pixels = canvas
        .getContext('2d')
        ?.getImageData(Math.round((left - rect.left) * scale), Math.round((top - rect.top) * scale), columns, rows).data
      if (!pixels) return
      for (let index = 0; index < pixels.length; index += 4) {
        const blue = pixels[index] < 90 && pixels[index + 1] > 60 && pixels[index + 1] < 140 && pixels[index + 2] > 200 && pixels[index + 3] > 200
        if (blue) found.push([left + ((index / 4) % columns) / scale, top + Math.floor(index / 4 / columns) / scale])
      }
    })
    if (found.length === 0) return null
    const xs = found.map((point) => point[0]).sort((a, b) => a - b)
    const middleX = xs[Math.floor(xs.length / 2)]
    const column = found.filter((point) => Math.abs(point[0] - middleX) < 1).map((point) => point[1]).sort((a, b) => a - b)
    return [middleX, column[Math.floor(column.length / 2)]] as [number, number]
  }, box)

const COLOR_TOLERANCE = 40
const EXACT_TOLERANCE = 16

const hasColor = (box: Box, [red, green, blue]: [number, number, number], tolerance = COLOR_TOLERANCE): Promise<boolean> =>
  page.evaluate(
    ({ area, wanted, tolerance }) =>
      [...document.querySelectorAll('.tv-lightweight-charts canvas')].some((element) => {
        const canvas = element as HTMLCanvasElement
        const rect = canvas.getBoundingClientRect()
        const scale = canvas.width / rect.width
        const left = Math.max(area.x, rect.left)
        const top = Math.max(area.y, rect.top)
        const right = Math.min(area.x + area.width, rect.right)
        const bottom = Math.min(area.y + area.height, rect.bottom)
        if (right - left < 1 || bottom - top < 1) return false
        const pixels = canvas
          .getContext('2d')
          ?.getImageData(
            Math.round((left - rect.left) * scale),
            Math.round((top - rect.top) * scale),
            Math.floor((right - left) * scale),
            Math.floor((bottom - top) * scale),
          ).data
        if (!pixels) return false
        for (let index = 0; index < pixels.length; index += 4) {
          const near =
            Math.abs(pixels[index] - wanted[0]) < tolerance &&
            Math.abs(pixels[index + 1] - wanted[1]) < tolerance &&
            Math.abs(pixels[index + 2] - wanted[2]) < tolerance
          if (near && pixels[index + 3] > 200) return true
        }
        return false
      }),
    { area: box, wanted: [red, green, blue], tolerance },
  )

const drag = async (from: [number, number], to: [number, number]): Promise<void> => {
  await page.mouse.move(...from)
  await page.mouse.down()
  await page.mouse.move(...to, { steps: 12 })
  await page.mouse.up()
}

const timeAxisPixels = async (): Promise<string> => {
  const rows = await page.locator('.tv-lightweight-charts tr').all()
  const boxes = (await Promise.all(rows.map((row) => row.boundingBox())))
    .filter((box): box is Box => box !== null && box.height > 10)
    .sort((first, second) => first.height - second.height)
  check(boxes.length >= 3, 'no se encontró el eje de tiempo')
  const axis = boxes[0]
  await page.mouse.move(700, 10)
  await page.waitForTimeout(400)
  const image = await page.screenshot({ clip: { x: axis.x, y: axis.y, width: axis.width - 80, height: axis.height } })
  return image.toString('base64')
}

const regionShot = async (box: Box): Promise<string> => {
  await page.mouse.move(700, 10)
  await page.waitForTimeout(400)
  return (await page.screenshot({ clip: box })).toString('base64')
}

const canvasRows = (box: Box): Promise<number[]> =>
  page.evaluate((area) => {
    const sums = Array.from({ length: Math.floor(area.height) }, () => 0)
    document.querySelectorAll('.tv-lightweight-charts canvas').forEach((element) => {
      const canvas = element as HTMLCanvasElement
      const rect = canvas.getBoundingClientRect()
      if (area.x < rect.left || area.x + area.width > rect.right || area.y < rect.top || area.y + area.height > rect.bottom) return
      const scale = canvas.width / rect.width
      const data = canvas
        .getContext('2d')
        ?.getImageData(Math.round((area.x - rect.left) * scale), Math.round((area.y - rect.top) * scale), Math.floor(area.width * scale), Math.floor(area.height * scale)).data
      if (!data) return
      const columns = Math.floor(area.width * scale)
      for (let index = 0; index < data.length; index += 4) {
        const row = Math.floor(Math.floor(index / 4 / columns) / scale)
        if (row < sums.length) sums[row] += data[index] + data[index + 1] + data[index + 2]
      }
    })
    return sums
  }, box)

const chooseTheme = async (label: 'Doji' | 'Midnight' | 'Light'): Promise<void> => {
  await button('Theme').click()
  await page.getByRole('menuitemradio', { name: label }).click()
  await page.waitForTimeout(300)
}

const flipTheme = (current: ThemeName): Promise<void> => chooseTheme(current === 'light' ? 'Midnight' : 'Light')

const chartPixel = (box: Box): Promise<number[]> =>
  page.evaluate((area) => {
    const counts = new Map<string, number>()
    for (let x = area.x + area.width * 0.2; x < area.x + area.width * 0.7; x += 7) {
      for (let y = area.y + 3; y < area.y + 40; y += 3) {
        for (const element of document.querySelectorAll('.tv-lightweight-charts canvas')) {
          const canvas = element as HTMLCanvasElement
          const rect = canvas.getBoundingClientRect()
          if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) continue
          const scale = canvas.width / rect.width
          const pixel = canvas.getContext('2d')?.getImageData(Math.round((x - rect.left) * scale), Math.round((y - rect.top) * scale), 1, 1).data
          if (!pixel || pixel[3] !== 255) continue
          const key = `${pixel[0]},${pixel[1]},${pixel[2]}`
          counts.set(key, (counts.get(key) ?? 0) + 1)
          break
        }
      }
    }
    const [common] = [...counts].sort((a, b) => b[1] - a[1])
    return common ? common[0].split(',').map(Number) : []
  }, box)

const near = (pixel: number[], wanted: number[]): boolean =>
  pixel.length === 3 && pixel.every((value, index) => Math.abs(value - wanted[index]) <= 3)

const backgroundOf = (locator: ReturnType<typeof page.locator>): Promise<string> =>
  locator.evaluate((node) => getComputedStyle(node).backgroundColor)

const waitForChart = async (): Promise<void> => {
  await page.waitForSelector('canvas', { timeout: 20_000 })
  await page.waitForTimeout(1500)
}

await step('abre la app con AAPL en diario', async () => {
  await page.goto(url)
  await waitForChart()
  await page.getByText('Apple Inc. · 1D · NASDAQ').waitFor({ timeout: 5000 })
})

await step('la leyenda sigue al cursor y vuelve a la última vela', async () => {
  const legend = () => page.getByText('Apple Inc. · 1D · NASDAQ').locator('..').innerText()
  const { price } = await panes()
  await page.mouse.move(700, 10)
  await page.waitForTimeout(300)
  const resting = await legend()
  await page.mouse.move(...at(price, 0.3, 0.5))
  await page.waitForTimeout(300)
  const first = await legend()
  await page.mouse.move(...at(price, 0.6, 0.5))
  await page.waitForTimeout(300)
  const second = await legend()
  check(first !== resting, 'la leyenda no cambió al pasar por una vela antigua')
  check(second !== first, 'la leyenda no cambió al pasar a otra vela')
  await page.mouse.move(700, 10)
  await page.waitForTimeout(300)
  check((await legend()) === resting, 'la leyenda no volvió a la última vela')
})

await step('doji abre con su propio tema: logo, icono de la pestaña, violeta y fondos cálidos', async () => {
  check((await savedState()).theme === 'doji', 'el tema por defecto no es el de doji')
  await page.getByRole('banner').getByRole('img', { name: 'doji' }).waitFor({ timeout: 5000 })
  check((await page.locator('link[rel="icon"]').getAttribute('href')) === '/favicon.svg', 'la pestaña no usa el icono de doji')
  const icon = await fetch(`${url}/favicon.svg`)
  check(icon.ok && (icon.headers.get('content-type') ?? '').startsWith('image/svg+xml'), `el icono no se sirve: ${icon.status}`)
  check((await icon.text()).includes('#7C5CFF'), 'el icono no es el violeta de doji')
  const active = await button('D').evaluate((node) => getComputedStyle(node).color)
  check(active === 'rgb(124, 92, 255)', `el periodo activo no usa el violeta de doji: ${active}`)
  check((await backgroundOf(page.getByRole('banner'))) === 'rgb(14, 13, 12)', 'la barra superior no tiene el fondo de doji')
  const { price } = await panes()
  check(near(await chartPixel(price), [21, 20, 18]), `el gráfico no tiene el fondo de doji: ${await chartPixel(price)}`)
})

await step('elige Midnight, el aspecto de siempre, desde el selector de temas', async () => {
  await chooseTheme('Midnight')
  check((await savedState()).theme === 'midnight', 'Midnight no se guardó')
  check((await backgroundOf(page.getByRole('banner'))) === 'rgb(0, 0, 0)', 'la barra superior no es negra en Midnight')
  const { price } = await panes()
  check(near(await chartPixel(price), [19, 23, 34]), `el gráfico no tiene el fondo de Midnight: ${await chartPixel(price)}`)
  check((await page.getByRole('menuitemradio').count()) === 0, 'el selector de temas siguió abierto')
})

await step('los precios en vivo mueven la lista, la pestaña y la última vela, y marcan en verde o rojo lo que cambia', async () => {
  const [quote] = (await (await fetch(`${url}/api/quotes?symbols=AAPL`)).json()) as Quote[]
  const history = (await (await fetch(`${url}/api/history?symbol=AAPL`)).json()) as History
  const lastBar = history.bars.at(-1)
  check(quote?.time !== undefined && quote.timezone !== undefined, 'la cotización no trae su hora ni su zona horaria')
  check(history.tradedAt !== undefined && lastBar !== undefined, 'el histórico no dice cuándo fue su última operación')
  const time = Math.max(quote.time ?? 0, history.tradedAt ?? 0) + 120_000
  check(dayInZone(quote.timezone ?? 'UTC', time) === lastBar?.time, 'la última vela no es del día de la cotización')
  const price = Number((Math.max(lastBar?.high ?? 0, quote.price) * 1.05).toFixed(2))
  const shown = price.toFixed(2)
  const tick: LiveTick = { symbol: 'AAPL', price, change: 0, changePercent: 0, time, session: 'regular', volume: null }
  const legend = async (period: string) =>
    (await page.getByText(`Apple Inc. · ${period} · NASDAQ`).locator('..').innerText()).replace(/\s+/g, '')
  await page.getByRole('img', { name: 'Prices refresh every 15 seconds' }).waitFor({ timeout: 5000 })
  streamBody = `retry: 1000\n\ndata: ${JSON.stringify([tick])}\n\n`
  await page.reload()
  await waitForChart()
  await page.getByRole('img', { name: 'Live prices' }).waitFor({ timeout: 10_000 })
  await row('AAPL').getByText(shown, { exact: true }).waitFor({ timeout: 10_000 })
  await page.waitForFunction((text) => document.title.startsWith(`AAPL ${text} ▲`), shown, { timeout: 5000 })
  await page.mouse.move(700, 10)
  await page.waitForTimeout(400)
  const daily = await legend('1D')
  check(daily.includes(`H${shown}`) && daily.includes(`C${shown}`), `la última vela diaria no cerró en ${shown}: ${daily}`)
  const drawn = (): Promise<string> =>
    page.evaluate(() =>
      [...document.querySelectorAll('.tv-lightweight-charts canvas')]
        .map((canvas) => (canvas as HTMLCanvasElement).toDataURL())
        .join('|'),
    )
  const before = await drawn()
  const higher = Number((price * 1.03).toFixed(2))
  const next: LiveTick = { ...tick, price: higher, time: time + 1000 }
  streamBody = `retry: 1000\n\ndata: ${JSON.stringify([next])}\n\n`
  const flashColor = (direction: 'up' | 'down'): Promise<string> =>
    row('AAPL')
      .locator(`[data-flash="${direction}"] > span`)
      .last()
      .evaluate((part) => getComputedStyle(part).color)
  await row('AAPL').getByText(higher.toFixed(2), { exact: true }).waitFor({ timeout: 10_000 })
  check((await flashColor('up')) === 'rgb(34, 171, 148)', `la subida no se marcó en verde: ${await flashColor('up')}`)
  await page.waitForTimeout(500)
  const moved = await legend('1D')
  check(moved.includes(`H${higher.toFixed(2)}`) && moved.includes(`C${higher.toFixed(2)}`), `la vela no siguió al precio: ${moved}`)
  check((await drawn()) !== before, 'el gráfico no se redibujó con el precio nuevo')
  const lower = Number((price * 1.01).toFixed(2))
  const last: LiveTick = { ...tick, price: lower, time: time + 2000 }
  streamBody = `retry: 1000\n\ndata: ${JSON.stringify([last])}\n\n`
  await row('AAPL').getByText(lower.toFixed(2), { exact: true }).waitFor({ timeout: 10_000 })
  check((await flashColor('down')) === 'rgb(242, 54, 69)', `la bajada no se marcó en rojo: ${await flashColor('down')}`)
  await page.waitForTimeout(3000)
  const resting = await row('AAPL')
    .locator('[data-flash="down"]')
    .evaluate((flash) => getComputedStyle(flash.parentElement as Element).color)
  check((await flashColor('down')) === resting, `la marca del precio no se apagó: ${await flashColor('down')}`)
  const fallen = await legend('1D')
  check(
    fallen.includes(`H${higher.toFixed(2)}`) && fallen.includes(`C${lower.toFixed(2)}`),
    `la vela no bajó su cierre conservando el máximo: ${fallen}`,
  )
  await button('W').click()
  await page.getByText('Apple Inc. · 1W · NASDAQ').waitFor({ timeout: 5000 })
  await page.waitForTimeout(400)
  const weekly = await legend('1W')
  const weekStart = mondayOf(lastBar?.time ?? '')
  const weekHigh = Math.max(higher, ...history.bars.filter((bar) => bar.time >= weekStart).map((bar) => bar.high))
  check(
    weekly.includes(`H${weekHigh.toFixed(2)}`) && weekly.includes(`C${lower.toFixed(2)}`),
    `la última vela semanal no cerró en ${lower.toFixed(2)} con máximo ${weekHigh.toFixed(2)}: ${weekly}`,
  )
  await button('D').click()
  await page.getByText('Apple Inc. · 1D · NASDAQ').waitFor({ timeout: 5000 })
  streamBody = QUIET_STREAM
  await page.reload()
  await waitForChart()
  await page.getByRole('img', { name: 'Prices refresh every 15 seconds' }).waitFor({ timeout: 10_000 })
  check(!((await row('AAPL').textContent()) ?? '').includes(lower.toFixed(2)), 'el precio de prueba sigue en la lista sin el canal en vivo')
  check(!(await legend('1D')).includes(`C${lower.toFixed(2)}`), 'la vela sigue en el precio de prueba sin el canal en vivo')
})

await step('cambia a semanal', async () => {
  await button('W').click()
  await page.getByText('Apple Inc. · 1W · NASDAQ').waitFor({ timeout: 5000 })
})

await step('dibuja una línea sobre el precio', async () => {
  await button('D').click()
  await page.waitForTimeout(500)
  const { price } = await panes()
  await drawLine(price, [0.3, 0.5], [0.6, 0.3])
  const lines = await linesOf('AAPL')
  check(lines.length === 1, `se esperaba 1 línea guardada y hay ${lines.length}`)
  check(lines[0].pane === 'price', 'la línea no está en el panel del precio')
  check(lines[0].p1.date < lines[0].p2.date, 'los extremos no tienen fechas crecientes')
  check((await button('Cursor').getAttribute('aria-pressed')) === 'true', 'la herramienta no volvió al cursor')
  await page.getByRole('toolbar', { name: 'Selected line' }).waitFor({ timeout: 2000 })
  await page.mouse.move(700, 10)
  await page.waitForTimeout(300)
  check(await bluePixelNear(...at(price, 0.45, 0.4)), 'no hay línea azul pintada entre los dos clics')
  check(!(await bluePixelNear(...at(price, 0.45, 0.75))), 'hay azul donde no debería haber línea')
})

await step('la línea sigue tras recargar', async () => {
  const before = await linesOf('AAPL')
  await page.reload()
  await waitForChart()
  const after = await linesOf('AAPL')
  check(JSON.stringify(after) === JSON.stringify(before), 'la línea cambió al recargar')
})

await step('la línea sigue en semanal', async () => {
  await button('W').click()
  await page.waitForTimeout(600)
  check((await linesOf('AAPL')).length === 1, 'la línea se perdió al pasar a semanal')
})

await step('dibuja una línea sobre el RSI', async () => {
  await button('D').click()
  await page.waitForTimeout(600)
  const { rsi } = await panes()
  await drawLine(rsi, [0.3, 0.35], [0.6, 0.65])
  const lines = await linesOf('AAPL')
  check(lines.length === 2, `se esperaban 2 líneas y hay ${lines.length}`)
  check(lines[1].pane === 'rsi' && lines[1].timeframe === 'D', 'la segunda línea no es del RSI diario')
  check(lines[1].p1.value > 0 && lines[1].p1.value < 100, `el valor del RSI no es creíble: ${lines[1].p1.value}`)
})

await step('la línea del RSI no se ve en semanal y vuelve en diario', async () => {
  const { rsi } = await panes()
  const middle = at(rsi, 0.45, 0.5)
  await button('W').click()
  await page.waitForTimeout(600)
  await page.mouse.click(...middle)
  check((await page.getByRole('toolbar', { name: 'Selected line' }).count()) === 0, 'la línea del RSI diario se puede seleccionar en semanal')
  await button('D').click()
  await page.waitForTimeout(600)
  await page.mouse.click(...middle)
  await page.getByRole('toolbar', { name: 'Selected line' }).waitFor({ timeout: 2000 })
})

await step('arrastra la línea del precio sin mover el gráfico', async () => {
  const { price } = await panes()
  const [before] = await linesOf('AAPL')
  const middle = at(price, 0.45, 0.4)
  await drag(middle, [middle[0] + 60, middle[1] + 40])
  const [after] = await linesOf('AAPL')
  check(after.p1.date > before.p1.date && after.p2.date > before.p2.date, 'la línea no se desplazó en el tiempo')
  check(after.p1.value < before.p1.value && after.p2.value < before.p2.value, 'la línea no bajó de precio')
  await page.mouse.click(...at(price, 0.45, 0.4))
  check((await page.getByRole('toolbar', { name: 'Selected line' }).count()) === 0, 'la línea sigue en su sitio antiguo')
})

await step('cambia color, grosor y extensión de la línea', async () => {
  const { price } = await panes()
  const middle = at(price, 0.45, 0.4)
  await page.mouse.click(middle[0] + 60, middle[1] + 40)
  await button('Color #F23645').click()
  await button('Line style').click()
  await button('Width 4').click()
  await button('Extend right').click()
  const [line] = await linesOf('AAPL')
  check(line.color === '#F23645' && line.width === 4 && line.extendRight, 'el estilo no se guardó')
  const remembered = async () => JSON.stringify((await savedState()).lineLooks.trend)
  check((await remembered()) === JSON.stringify({ color: '#F23645', width: 4 }), 'no se recordó el aspecto de la línea de tendencia')
  await button('Color #2962FF').click()
  await button('Width 2').click()
  check((await remembered()) === JSON.stringify({ color: '#2962FF', width: 2 }), 'no se recordó el aspecto de vuelta')
})

await step('borra la línea del precio con Supr', async () => {
  await page.keyboard.press('Delete')
  const lines = await linesOf('AAPL')
  check(lines.length === 1 && lines[0].pane === 'rsi', 'no quedó solo la línea del RSI')
})

await step('cancela una línea a medias con Esc', async () => {
  const { price } = await panes()
  await pickTool('Trend line')
  await page.mouse.click(...at(price, 0.2, 0.6))
  await page.mouse.move(...at(price, 0.4, 0.4), { steps: 4 })
  await page.keyboard.press('Escape')
  check((await linesOf('AAPL')).length === 1, 'Esc no canceló la línea')
  check((await button('Cursor').getAttribute('aria-pressed')) === 'true', 'Esc no devolvió el cursor')
})

await step('Esc con la herramienta armada vuelve al cursor', async () => {
  await pickTool('Trend line')
  check((await button('Trend line').getAttribute('aria-pressed')) === 'true', 'la herramienta no se armó')
  await page.keyboard.press('Escape')
  check((await button('Cursor').getAttribute('aria-pressed')) === 'true', 'Esc no devolvió el cursor')
})

await step('un clic que empieza fuera del gráfico no termina la línea', async () => {
  const { price } = await panes()
  await pickTool('Trend line')
  await page.mouse.click(...at(price, 0.2, 0.6))
  await page.mouse.move(26, 700)
  await page.mouse.down()
  await page.mouse.move(...at(price, 0.5, 0.4), { steps: 8 })
  await page.mouse.up()
  check((await linesOf('AAPL')).length === 1, 'la línea se terminó con un clic que empezó fuera del gráfico')
  await page.keyboard.press('Escape')
  check((await button('Cursor').getAttribute('aria-pressed')) === 'true', 'Esc no devolvió el cursor')
})

await step('mover una línea en vertical en semanal conserva sus fechas', async () => {
  const isMonday = (date: string): boolean => new Date(`${date}T00:00:00Z`).getUTCDay() === 1
  const { price } = await panes()
  const drawFrom = async (shift: number): Promise<TrendLine> => {
    await pickTool('Trend line')
    await page.mouse.click(price.x + price.width * 0.3 + shift, price.y + price.height * 0.5)
    await page.mouse.click(price.x + price.width * 0.6 + shift, price.y + price.height * 0.5)
    const drawn = (await linesOf('AAPL')).find((line) => line.pane === 'price')
    check(drawn !== undefined, 'la línea de prueba no se guardó')
    return drawn as TrendLine
  }
  let before = await drawFrom(0)
  for (let attempt = 1; attempt <= 4 && isMonday(before.p1.date) && isMonday(before.p2.date); attempt += 1) {
    await page.keyboard.press('Delete')
    before = await drawFrom(attempt * 9)
  }
  check(!isMonday(before.p1.date) || !isMonday(before.p2.date), 'no se consiguió una línea con un extremo fuera de lunes')
  await button('W').click()
  await page.waitForTimeout(700)
  const weekly = await panes()
  await page.mouse.move(700, 10)
  await page.waitForTimeout(300)
  const spot = await blueCentre(weekly.price)
  check(spot !== null, 'no se encontró la línea en semanal')
  const grip = spot as [number, number]
  await drag(grip, [grip[0], grip[1] + 50])
  const after = (await linesOf('AAPL')).find((line) => line.id === before.id)
  check(after !== undefined, 'la línea desapareció al arrastrarla en semanal')
  check(after?.p1.value !== before.p1.value && after?.p2.value !== before.p2.value, 'la línea no cambió de precio')
  check(after?.p1.date === before.p1.date && after?.p2.date === before.p2.date, `las fechas cambiaron: ${before.p1.date}→${after?.p1.date}, ${before.p2.date}→${after?.p2.date}`)
  await page.keyboard.press('Delete')
  check((await linesOf('AAPL')).every((line) => line.pane === 'rsi'), 'la línea de prueba no se borró')
  await button('D').click()
  await page.waitForTimeout(700)
})

await step('el gráfico se desplaza al arrastrar en vacío', async () => {
  const { price } = await panes()
  const before = await timeAxisPixels()
  await drag(at(price, 0.5, 0.12), at(price, 0.75, 0.12))
  const after = await timeAxisPixels()
  check(before !== after, 'el gráfico no se movió')
  check((await button('Auto').count()) === 0, 'un arrastre horizontal soltó el ajuste automático')
})

await step('arrastrar en vertical mueve el gráfico y «Auto» lo vuelve a encajar', async () => {
  const { price } = await panes()
  const settle = async (): Promise<void> => {
    await page.mouse.move(700, 10)
    await page.waitForTimeout(400)
  }
  const referenceY = async (): Promise<number> => {
    await settle()
    const spot = await blueCentre(price)
    check(spot !== null, 'no se encontró la línea de referencia')
    return (spot as [number, number])[1]
  }
  await pickTool('Trend line')
  await page.mouse.click(...at(price, 0.3, 0.45))
  await page.mouse.click(...at(price, 0.6, 0.45))
  await page.mouse.click(...at(price, 0.1, 0.12))
  const before = await referenceY()
  check((await button('Auto').count()) === 0, 'el botón Auto aparece antes de mover nada')
  const start = at(price, 0.8, 0.15)
  await drag(start, [start[0], start[1] + 70])
  const lowered = (await referenceY()) - before
  check(lowered >= 45 && lowered <= 72, `la línea debía bajar con el arrastre y bajó ${Math.round(lowered)} px`)
  await button('Auto').waitFor({ timeout: 3000 })
  await drag(start, [start[0], start[1] - 40])
  const raised = (await referenceY()) - before
  check(raised < lowered - 20, `la línea debía subir con el segundo arrastre y quedó a ${Math.round(raised)} px`)
  await button('Auto').click()
  const fitted = (await referenceY()) - before
  check(Math.abs(fitted) <= 2, `tras «Auto» la línea quedó a ${Math.round(fitted)} px de donde estaba`)
  check((await button('Auto').count()) === 0, 'el botón Auto sigue después de encajar')
})

await step('el botón «Auto» sigue lo que se hace en el eje de precios', async () => {
  const { price } = await panes()
  const axisX = price.x + price.width - 25
  await drag([axisX, price.y + price.height * 0.3], [axisX, price.y + price.height * 0.5])
  await button('Auto').waitFor({ timeout: 3000 })
  await page.mouse.dblclick(axisX, price.y + price.height * 0.4)
  await page.waitForTimeout(400)
  check((await button('Auto').count()) === 0, 'el doble clic en el eje no devolvió el ajuste automático')
  await page.mouse.move(700, 10)
  await page.waitForTimeout(300)
  const spot = await blueCentre(price)
  check(spot !== null, 'no se encontró la línea de referencia para borrarla')
  await page.mouse.click(...(spot as [number, number]))
  await page.keyboard.press('Delete')
  check((await linesOf('AAPL')).every((line) => line.pane === 'rsi'), 'la línea de referencia no se borró')
})


await step('una línea horizontal se pone con un clic y se arrastra', async () => {
  const { price } = await panes()
  const levels = async () => (await drawingsOf('AAPL')).filter((drawing) => drawing.kind === 'hline')
  const y = price.y + price.height * 0.3
  await pickTool('Horizontal line')
  await page.mouse.click(price.x + price.width * 0.4, y)
  const [placed] = await levels()
  check(placed !== undefined, 'la línea horizontal no se guardó')
  check((await button('Cursor').getAttribute('aria-pressed')) === 'true', 'la herramienta no volvió al cursor')
  const grip: [number, number] = [price.x + price.width * 0.15, y]
  await drag(grip, [grip[0], grip[1] + 60])
  const [moved] = await levels()
  check(moved !== undefined && placed !== undefined && moved.value < placed.value, 'la línea horizontal no bajó al arrastrarla')
  check((await button('Auto').count()) === 0, 'arrastrar la línea horizontal soltó el ajuste automático')
  await page.keyboard.press('Delete')
  check((await levels()).length === 0, 'la línea horizontal no se borró')
})

await step('una línea horizontal se deja blanca, fina, discontinua, tenue y sin precio en el eje', async () => {
  const { price } = await panes()
  const levels = async () => (await drawingsOf('AAPL')).filter((drawing) => drawing.kind === 'hline')
  const y = price.y + price.height * 0.3
  const axis = { x: price.x + price.width - 58, y: y - 5, width: 50, height: 10 }
  await pickTool('Horizontal line')
  await page.mouse.click(price.x + price.width * 0.4, y)
  await page.mouse.click(price.x + price.width * 0.15, y)
  await page.getByRole('toolbar', { name: 'Selected line' }).waitFor({ timeout: 2000 })
  await button('Color #FFFFFF').click()
  await button('Line style').click()
  await button('Width 1').click()
  await button('Dashed line').click()
  await page.getByRole('slider', { name: 'Opacity' }).fill('50')
  await page.mouse.move(700, 10)
  await page.waitForTimeout(300)
  check(await hasColor(axis, [255, 255, 255], EXACT_TOLERANCE), 'el precio de la línea blanca no se ve en el eje')
  await button('Price on the axis').click()
  await page.mouse.move(700, 10)
  await page.waitForTimeout(300)
  const [line] = await levels()
  check(
    line?.color === '#FFFFFF' && line.width === 1 && line.lineStyle === 'dashed' && line.opacity === 0.5 && line.hidePrice === true,
    `la línea no guardó su aspecto: ${JSON.stringify(line)}`,
  )
  check(!(await hasColor(axis, [255, 255, 255], EXACT_TOLERANCE)), 'el precio sigue en el eje tras ocultarlo')
  await page.getByRole('textbox', { name: 'Text on the line' }).fill('R1')
  await page.keyboard.press('Enter')
  const [named] = await levels()
  check(named?.kind === 'hline' && named.text === 'R1', `la línea no guardó su texto: ${JSON.stringify(named)}`)
  await page.mouse.click(price.x + price.width * 0.15, y)
  await page.keyboard.press('Delete')
  check((await levels()).length === 0, 'la línea blanca no se borró')
})

await step('una línea nueva sale con el último aspecto que se dio a una de su tipo', async () => {
  const { price } = await panes()
  const levels = async () => (await drawingsOf('AAPL')).filter((drawing) => drawing.kind === 'hline')
  const y = price.y + price.height * 0.45
  await pickTool('Horizontal line')
  await page.mouse.click(price.x + price.width * 0.4, y)
  const [fresh] = await levels()
  check(
    fresh?.kind === 'hline' &&
      fresh.color === '#FFFFFF' &&
      fresh.width === 1 &&
      fresh.lineStyle === 'dashed' &&
      fresh.opacity === 0.5 &&
      fresh.hidePrice === true &&
      fresh.text === undefined,
    `la línea nueva no recordó el aspecto: ${JSON.stringify(fresh)}`,
  )
  await page.mouse.click(price.x + price.width * 0.15, y)
  await page.getByRole('toolbar', { name: 'Selected line' }).waitFor({ timeout: 2000 })
  await button('Color #2962FF').click()
  await button('Line style').click()
  await button('Width 2').click()
  await button('Solid line').click()
  await page.getByRole('slider', { name: 'Opacity' }).fill('100')
  await button('Price on the axis').click()
  check(
    JSON.stringify((await savedState()).lineLooks.hline) === JSON.stringify({ color: '#2962FF', width: 2 }),
    `no se recordó el aspecto de vuelta: ${JSON.stringify((await savedState()).lineLooks)}`,
  )
  await page.keyboard.press('Delete')
  check((await levels()).length === 0, 'la línea de prueba no se borró')
})

await step('la regla mide entre dos puntos sin guardar nada y se quita con Esc', async () => {
  const { price } = await panes()
  const before = (await drawingsOf('AAPL')).length
  const area = { x: price.x + price.width * 0.25, y: price.y + price.height * 0.2, width: price.width * 0.4, height: price.height * 0.6 }
  const clean = await regionShot(area)
  await button('Measure').click()
  await page.mouse.click(...at(price, 0.3, 0.6))
  await page.mouse.click(...at(price, 0.6, 0.3))
  check((await button('Cursor').getAttribute('aria-pressed')) === 'true', 'la regla no volvió al cursor')
  check((await drawingsOf('AAPL')).length === before, 'la regla guardó un dibujo')
  check((await regionShot(area)) !== clean, 'la medida no se ve en el gráfico')
  await page.keyboard.press('Escape')
  check((await regionShot(area)) === clean, 'la medida sigue en el gráfico tras Esc')
  await page.keyboard.press('Alt+m')
  check((await button('Measure').getAttribute('aria-pressed')) === 'true', 'Alt+M no armó la regla')
  await page.keyboard.press('Escape')
})

await step('una posición larga se pone con un clic, calcula las acciones y su objetivo se arrastra', async () => {
  const { price } = await panes()
  const positions = async () => (await drawingsOf('AAPL')).filter((drawing) => drawing.kind === 'position')
  const [x, y] = at(price, 0.5, 0.5)
  await pickTool('Long position')
  await page.mouse.click(x, y)
  const [placed] = await positions()
  check(placed?.kind === 'position' && placed.side === 'long', `la posición no se guardó: ${JSON.stringify(placed)}`)
  check(placed.stop < placed.p1.value && placed.target > placed.p1.value, 'el stop o el objetivo no están en su lado')
  check((await button('Cursor').getAttribute('aria-pressed')) === 'true', 'la herramienta no volvió al cursor')
  await page.getByRole('textbox', { name: 'Account size' }).fill('10000')
  await page.keyboard.press('Enter')
  await page.getByRole('textbox', { name: 'Risk %' }).fill('1')
  await page.keyboard.press('Enter')
  await button('Alert').click()
  const [sized] = await positions()
  check(sized?.kind === 'position' && sized.account === 10000 && sized.riskPercent === 1 && sized.alert === true, `la posición no guardó su tamaño o su alerta: ${JSON.stringify(sized)}`)
  await page.mouse.move(700, 10)
  await page.waitForTimeout(300)
  await drag([x, y - 80], [x, y - 120])
  const [stretched] = await positions()
  check(
    stretched?.kind === 'position' && stretched.target > placed.target && stretched.stop === placed.stop,
    `el objetivo no subió al arrastrarlo: ${JSON.stringify(stretched)}`,
  )
  await page.keyboard.press('Delete')
  check((await positions()).length === 0, 'la posición no se borró')
})

await step('los soportes y resistencias se activan, se fijan con un clic y se quitan', async () => {
  const { price } = await panes()
  const strip = { x: price.x + price.width * 0.05, y: price.y + 20, width: price.width * 0.3, height: price.height * 0.6 }
  const before = (await drawingsOf('AAPL')).length
  await page.mouse.move(700, 10)
  const clean = await canvasRows(strip)
  await button('Indicators').click()
  await page.getByRole('checkbox', { name: 'Support & resistance' }).click()
  await page.keyboard.press('Escape')
  await page.mouse.move(700, 10)
  await page.waitForTimeout(400)
  check((await savedState()).indicators.levels.visible, 'el indicador de niveles no se guardó')
  const shown = await canvasRows(strip)
  const changed = shown.flatMap((sum, row) => (sum !== clean[row] ? [row] : []))
  check(changed.length > 0, 'no se ve ningún nivel en el gráfico')
  const y = strip.y + changed[0] + 0.5
  await page.mouse.click(price.x + price.width * 0.2, y)
  const pinned = (await drawingsOf('AAPL')).filter((drawing) => drawing.kind === 'hline')
  check((await drawingsOf('AAPL')).length === before + 1, 'el clic no fijó el nivel como línea')
  const [line] = pinned
  check(
    line?.kind === 'hline' && line.lineStyle === 'dashed' && line.opacity === 0.5 && line.hidePrice === true && line.width === 1,
    `el nivel fijado no tiene el aspecto de los niveles: ${JSON.stringify(line)}`,
  )
  await page.keyboard.press('Delete')
  check((await drawingsOf('AAPL')).length === before, 'el nivel fijado no se borró')
  await button('Indicators').click()
  await page.getByRole('checkbox', { name: 'Support & resistance' }).click()
  await page.keyboard.press('Escape')
  await page.mouse.move(700, 10)
  await page.waitForTimeout(400)
  check(!(await savedState()).indicators.levels.visible, 'el indicador de niveles no se quitó')
  check(JSON.stringify(await canvasRows(strip)) === JSON.stringify(clean), 'quedan niveles en el gráfico')
})

await step('el perfil de volumen aparece a la derecha del gráfico y se quita', async () => {
  const { price } = await panes()
  const side = { x: price.x + price.width * 0.72, y: price.y + 10, width: price.width * 0.2, height: price.height * 0.6 }
  const clean = await regionShot(side)
  await button('Indicators').click()
  await page.getByRole('checkbox', { name: 'Volume profile' }).click()
  await page.keyboard.press('Escape')
  check((await savedState()).indicators.volumeProfile.visible, 'el perfil de volumen no se guardó')
  check((await regionShot(side)) !== clean, 'el perfil de volumen no se ve')
  await button('Indicators').click()
  await page.getByRole('checkbox', { name: 'Volume profile' }).click()
  await page.keyboard.press('Escape')
  check(!(await savedState()).indicators.volumeProfile.visible, 'el perfil de volumen no se quitó')
  check((await regionShot(side)) === clean, 'queda rastro del perfil de volumen')
})

await step('los patrones de velas se marcan al encenderlos y se quitan al apagarlos', async () => {
  const { price } = await panes()
  await button('Show 5 years').click()
  const clean = await regionShot(price)
  await button('Indicators').click()
  await page.getByRole('checkbox', { name: 'Candle patterns' }).click()
  await page.keyboard.press('Escape')
  check((await savedState()).indicators.patterns.visible, 'los patrones no se guardaron')
  check((await regionShot(price)) !== clean, 'no se marcó ningún patrón en cinco años de velas')
  await button('Indicators').click()
  await page.getByRole('checkbox', { name: 'Candle patterns' }).click()
  await page.keyboard.press('Escape')
  check((await regionShot(price)) === clean, 'quedan marcas de patrones al apagarlos')
  await button('Show 1 year').click()
})

await step('los huecos sin cerrar se sombrean al encenderlos y se quitan al apagarlos', async () => {
  const { price } = await panes()
  await button('Show all').click()
  const clean = await regionShot(price)
  await button('Indicators').click()
  await page.getByRole('checkbox', { name: 'Open gaps' }).click()
  await page.getByRole('spinbutton', { name: 'Minimum gap %' }).fill('0.5')
  await page.getByRole('spinbutton', { name: 'Minimum gap %' }).press('Enter')
  await page.keyboard.press('Escape')
  const gaps = (await savedState()).indicators.gaps
  check(gaps.visible && gaps.minPercent === 0.5, `los huecos no se guardaron: ${JSON.stringify(gaps)}`)
  const { symbol } = await savedState()
  const history = (await page.evaluate(async (wanted) => (await fetch(`/api/history?symbol=${wanted}`)).json(), symbol)) as History
  const expected = findOpenGaps(history.bars, 0.5).length > 0
  check(((await regionShot(price)) !== clean) === expected, expected ? 'no se sombreó ningún hueco en toda la historia' : 'se sombreó un hueco que no existe')
  await button('Indicators').click()
  await page.getByRole('checkbox', { name: 'Open gaps' }).click()
  await page.keyboard.press('Escape')
  check((await regionShot(price)) === clean, 'queda sombra de huecos al apagarlos')
  await button('Show 1 year').click()
})

await step('las divergencias del RSI se dibujan sobre el precio y el RSI al encenderlas', async () => {
  const { price, rsi } = await panes()
  await button('Show 5 years').click()
  const cleanPrice = await regionShot(price)
  const cleanRsi = await regionShot(rsi)
  await button('Indicators').click()
  await page.getByRole('checkbox', { name: 'RSI divergences' }).click()
  await page.keyboard.press('Escape')
  check((await savedState()).indicators.divergences.visible, 'las divergencias no se guardaron')
  check((await regionShot(price)) !== cleanPrice && (await regionShot(rsi)) !== cleanRsi, 'no se dibujó ninguna divergencia en cinco años')
  await button('Indicators').click()
  await page.getByRole('checkbox', { name: 'RSI divergences' }).click()
  await page.keyboard.press('Escape')
  check((await regionShot(price)) === cleanPrice, 'quedan líneas de divergencias al apagarlas')
  await button('Show 1 year').click()
})

await step('la leyenda dice cuándo son los próximos resultados', async () => {
  await page.getByText(/^Earnings ~?[A-Z][a-z]{2} \d{1,2}, \d{4}( · EPS est\. [−-]?\d+\.\d{2})?$/).waitFor({ timeout: 15_000 })
  const earnings = await page.evaluate(async () => (await fetch('/api/earnings?symbol=AAPL')).json())
  check(Array.isArray(earnings.past) && earnings.past.length > 0, `no llegaron resultados pasados: ${JSON.stringify(earnings)}`)
})

await step('los dividendos se marcan con una D, la leyenda dice su importe y se pueden ocultar', async () => {
  const history = await page.evaluate(async () => (await fetch('/api/history?symbol=AAPL')).json())
  check(Array.isArray(history.dividends) && history.dividends.length > 0, `no llegaron dividendos: ${JSON.stringify(history.dividends)}`)
  const { price } = await panes()
  const strip = { x: price.x, y: price.y + price.height - 40, width: price.width - 80, height: 38 }
  const marked = await regionShot(strip)
  let named = false
  for (let x = price.x + 4; x < price.x + price.width - 90 && !named; x += 3) {
    await page.mouse.move(x, price.y + price.height * 0.5)
    named = (await page.getByText(/^Dividend \d+\.\d{2,4}$/).count()) > 0
  }
  check(named, 'la leyenda no dijo el importe de ningún dividendo')
  await button('Indicators').click()
  await page.getByRole('checkbox', { name: 'Dividend marks' }).click()
  await page.keyboard.press('Escape')
  check(!(await savedState()).indicators.marks.dividends, 'ocultar los dividendos no se guardó')
  check((await regionShot(strip)) !== marked, 'las marcas de dividendos no se quitaron')
  await button('Indicators').click()
  await page.getByRole('checkbox', { name: 'Dividend marks' }).click()
  await page.keyboard.press('Escape')
  check((await savedState()).indicators.marks.dividends, 'volver a enseñar los dividendos no se guardó')
  check((await regionShot(strip)) === marked, 'las marcas de dividendos no volvieron igual')
})

await step('la vela de unos resultados dice el beneficio por acción real, el esperado y la sorpresa', async () => {
  const { price } = await panes()
  let named = false
  for (let x = price.x + 4; x < price.x + price.width - 90 && !named; x += 3) {
    await page.mouse.move(x, price.y + price.height * 0.5)
    named = (await page.getByText(/^EPS [−-]?\d+\.\d{2}( vs [−-]?\d+\.\d{2} est\.( \([+−]?\d+\.\d{2}%\))?)?$/).count()) > 0
  }
  check(named, 'la leyenda no dijo el beneficio por acción de ninguna presentación')
  await page.mouse.move(700, 10)
})

await step('el calendario de resultados enseña la última presentación de una acción y abre su gráfico', async () => {
  const onScreen = (await savedState()).symbol
  const symbols = activeItems(await savedState()).map((item) => item.symbol)
  await button('Earnings calendar').click()
  const dialog = page.getByRole('dialog', { name: 'Earnings calendar' })
  await dialog.waitFor({ timeout: 3000 })
  await dialog.getByRole('status').waitFor({ state: 'detached', timeout: 180_000 })
  const answer = await page.evaluate(
    async (list) => (await fetch(`/api/earnings/calendar?symbols=${list.join(',')}`)).json(),
    symbols,
  )
  const reports = Object.entries(answer.earnings as Record<string, { past: string[] }>).flatMap(([symbol, earnings]) =>
    earnings.past.map((date) => ({ symbol, date })),
  )
  check(reports.length > 0, `no llegó ninguna fecha de resultados: ${JSON.stringify(answer)}`)
  const latest = reports.sort((a, b) => b.date.localeCompare(a.date))[0]
  const today = new Date().toISOString().slice(0, 10)
  const weeksBack = Math.round((Date.parse(mondayOf(today)) - Date.parse(mondayOf(latest.date))) / (7 * 86_400_000))
  for (let week = 0; week < weeksBack; week += 1) await dialog.getByRole('button', { name: 'Previous week' }).click()
  const entry = dialog.getByRole('button', { name: new RegExp(`^${latest.symbol.replace(/[.^$]/g, '\\$&')},`) })
  await entry.first().waitFor({ timeout: 3000 })
  await entry.first().click()
  check((await dialog.count()) === 0, 'el calendario no se cerró al elegir una acción')
  check((await savedState()).symbol === latest.symbol, `el gráfico no cambió a ${latest.symbol}`)
  await button('Earnings calendar').click()
  await dialog.getByRole('checkbox', { name: 'Warn in the watchlist when earnings are less than a week away' }).click()
  check((await savedState()).earningsBadge, 'el aviso de resultados no se guardó')
  await dialog.getByRole('checkbox', { name: 'Warn in the watchlist when earnings are less than a week away' }).click()
  check(!(await savedState()).earningsBadge, 'el aviso de resultados no se quitó')
  await page.keyboard.press('Escape')
  check((await dialog.count()) === 0, 'Esc no cerró el calendario')
  await row(onScreen).click()
  await page.waitForFunction((wanted) => document.title.startsWith(`${wanted} `), onScreen, { timeout: 15_000 })
})

await step('el modo repetición oculta el futuro, avanza vela a vela y sale sin guardar nada', async () => {
  const { price } = await panes()
  const before = await savedState()
  const replaying = async (): Promise<number> => {
    const text = (await page.getByText(/^Replaying /).textContent()) ?? ''
    return Date.parse(text.replace('Replaying ', ''))
  }
  await button('Replay').click()
  await page.getByText('Click a bar on the chart to start the replay from it.').waitFor({ timeout: 3000 })
  await page.mouse.click(...at(price, 0.5, 0.5))
  await page.getByText(/^Replaying /).waitFor({ timeout: 3000 })
  const first = await replaying()
  check(Number.isFinite(first) && first < Date.now() - 86_400_000, `la repetición no empezó en el pasado: ${first}`)
  await button('Step forward').click()
  const second = await replaying()
  check(second > first, 'avanzar no movió la repetición')
  await page.mouse.move(700, 10)
  await page.keyboard.press('ArrowRight')
  check((await replaying()) > second, 'la flecha derecha no avanzó la repetición')
  check((await button('Replay').getAttribute('aria-pressed')) === 'true', 'el botón no marca la repetición')
  const replayed = await timeAxisPixels()
  await page.keyboard.press('Escape')
  check((await page.getByRole('toolbar', { name: 'Replay' }).count()) === 0, 'Esc no salió de la repetición')
  const back = await timeAxisPixels()
  check(back !== replayed, 'al salir de la repetición el gráfico no volvió a la última vela')
  const after = await savedState()
  check(after.rev === before.rev && after.symbol === before.symbol, 'la repetición guardó algo')
})

await step('la línea vertical, el rayo, la zona, el texto y la flecha se dibujan desde sus menús', async () => {
  const { price } = await panes()
  const before = (await drawingsOf('AAPL')).map((drawing) => drawing.id)
  const added = async () => (await drawingsOf('AAPL')).filter((drawing) => !before.includes(drawing.id))
  await pickTool('Vertical line')
  await page.mouse.click(...at(price, 0.3, 0.5))
  await pickTool('Horizontal ray')
  await page.mouse.click(...at(price, 0.4, 0.35))
  await pickTool('Horizontal zone')
  await page.mouse.click(...at(price, 0.5, 0.6))
  await page.mouse.click(...at(price, 0.5, 0.7))
  await pickTool('Text')
  await page.mouse.click(...at(price, 0.6, 0.25))
  const field = page.getByRole('textbox', { name: 'Text on the line' })
  await field.fill('Resultados')
  await field.press('Enter')
  await pickTool('Trend line')
  await page.mouse.click(...at(price, 0.2, 0.8))
  await page.mouse.click(...at(price, 0.35, 0.65))
  await button('Line style').click()
  await button('Arrow').click()
  await page.keyboard.press('Escape')
  const drawn = await added()
  const kinds = drawn.map((drawing) => (drawing.kind === 'hline' && drawing.from ? 'ray' : (drawing.kind ?? 'trend')))
  check(JSON.stringify(kinds) === JSON.stringify(['vline', 'ray', 'zone', 'note', 'trend']), `no se dibujaron los cinco: ${JSON.stringify(kinds)}`)
  const [, , zone, note, arrow] = drawn
  check(zone?.kind === 'zone' && zone.top > zone.bottom, 'la zona no tiene su banda de precios')
  check(note?.kind === 'note' && note.text === 'Resultados', `el texto no se guardó: ${JSON.stringify(note)}`)
  check(arrow !== undefined && 'arrow' in arrow && arrow.arrow === true, 'la línea no se volvió flecha')
  const latest = await savedState()
  await fetch(`${url}/api/state`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...latest, lines: { ...latest.lines, AAPL: (latest.lines.AAPL ?? []).filter((drawing) => before.includes(drawing.id)) } }),
  })
  await page.reload()
  await waitForChart()
})

await step('el ojo oculta los dibujos, el candado los fija y la lista oculta o borra cada uno', async () => {
  const { price } = await panes()
  const levels = async () => (await drawingsOf('AAPL')).filter((drawing) => drawing.kind === 'hline' && !drawing.from)
  const before = (await levels()).length
  const clean = await regionShot(price)
  await pickTool('Horizontal line')
  await page.mouse.click(...at(price, 0.5, 0.45))
  await page.keyboard.press('Escape')
  const drawn = (await levels()).at(-1)
  check((await levels()).length === before + 1 && drawn !== undefined, 'la línea no se dibujó')
  const withLine = await regionShot(price)
  await button('Hide all drawings').click()
  check((await savedState()).drawingsHidden, 'ocultar los dibujos no se guardó')
  check((await regionShot(price)) === clean, 'la línea se sigue viendo con los dibujos ocultos')
  await button('Show all drawings').click()
  check((await regionShot(price)) === withLine, 'la línea no volvió al enseñar los dibujos')
  await page.mouse.click(...at(price, 0.5, 0.45))
  await page.getByRole('button', { name: 'Delete line' }).waitFor({ timeout: 5_000 })
  await button('Lock drawings').click()
  const unselected = await page.getByRole('button', { name: 'Delete line' }).waitFor({ state: 'detached', timeout: 5_000 }).then(() => true, () => false)
  check(unselected, `el candado no quitó la selección de la línea (candado guardado: ${(await savedState()).drawingsLocked})`)
  await page.mouse.click(...at(price, 0.5, 0.45))
  check((await page.getByRole('button', { name: 'Delete line' }).count()) === 0, 'con el candado se pudo seleccionar la línea')
  await button('Lock drawings').click()
  check(!(await savedState()).drawingsLocked, 'el candado no se quitó')
  await button('Drawings list').click()
  const item = new RegExp(`^Hide Horizontal line ${drawn?.kind === 'hline' ? drawn.value.toFixed(2).replace('.', '\\.') : ''}`)
  await page.getByRole('button', { name: item }).click()
  check((await levels()).at(-1)?.hidden === true, 'la lista no ocultó la línea')
  await page.getByRole('button', { name: /^Delete Horizontal line / }).last().click()
  check((await levels()).length === before, 'la lista no borró la línea')
  await page.keyboard.press('Escape')
})

await step('un rectángulo se dibuja con dos clics y se cambia por una esquina', async () => {
  const { price } = await panes()
  const boxes = async () => (await drawingsOf('AAPL')).filter((drawing) => drawing.kind === 'rect')
  await pickTool('Rectangle')
  await page.mouse.click(...at(price, 0.3, 0.3))
  await page.mouse.click(...at(price, 0.5, 0.5))
  const [drawn] = await boxes()
  check(drawn !== undefined, 'el rectángulo no se guardó')
  await drag(at(price, 0.5, 0.5), at(price, 0.6, 0.6))
  const [resized] = await boxes()
  check(
    resized !== undefined && drawn !== undefined && resized.p2.date > drawn.p2.date && resized.p2.value < drawn.p2.value,
    'la esquina del rectángulo no se movió',
  )
  check(resized?.p1.date === drawn?.p1.date && resized?.p1.value === drawn?.p1.value, 'se movió también la esquina opuesta')
  await page.keyboard.press('Delete')
  check((await boxes()).length === 0, 'el rectángulo no se borró')
})

await step('un canal paralelo se dibuja con tres clics y se ensancha por su segunda línea', async () => {
  const { price } = await panes()
  const channels = async () => (await drawingsOf('AAPL')).filter((drawing) => drawing.kind === 'channel')
  await pickTool('Parallel channel')
  await page.mouse.click(...at(price, 0.3, 0.5))
  await page.mouse.click(...at(price, 0.6, 0.4))
  check((await channels()).length === 0, 'el canal se guardó antes de darle ancho')
  await page.mouse.click(...at(price, 0.45, 0.6))
  const [drawn] = await channels()
  check(drawn !== undefined && drawn.offset < 0, `el canal no se guardó con su segunda línea por debajo: ${drawn?.offset}`)
  await drag(at(price, 0.45, 0.6), at(price, 0.45, 0.7))
  const [wider] = await channels()
  check(wider !== undefined && drawn !== undefined && wider.offset < drawn.offset, 'el canal no se ensanchó')
  check(wider?.p1.date === drawn?.p1.date && wider?.p2.value === drawn?.p2.value, 'se movió la línea base del canal')
  await page.keyboard.press('Delete')
  check((await channels()).length === 0, 'el canal no se borró')
})

await step('cambia a mensual y vuelve a diario', async () => {
  await button('M').click()
  await page.getByText(/ · 1M · /).waitFor({ timeout: 5000 })
  check((await savedState()).timeframe === 'M', 'el periodo mensual no se guardó')
  await button('D').click()
  await page.getByText(/ · 1D · /).waitFor({ timeout: 5000 })
})

await step('deshacer y rehacer devuelven y quitan un dibujo', async () => {
  const { price } = await panes()
  const levels = async (): Promise<number> => (await drawingsOf('AAPL')).filter((drawing) => drawing.kind === 'hline').length
  await pickTool('Horizontal line')
  await page.mouse.click(...at(price, 0.4, 0.35))
  check((await levels()) === 1, 'la línea horizontal de prueba no se guardó')
  await page.waitForTimeout(500)
  await page.keyboard.press('Delete')
  check((await levels()) === 0, 'la línea horizontal no se borró')
  await page.keyboard.press('Control+z')
  check((await levels()) === 1, 'deshacer no devolvió la línea borrada')
  await page.keyboard.press('Control+Shift+z')
  check((await levels()) === 0, 'rehacer no volvió a borrar la línea')
  await page.keyboard.press('Control+z')
  await page.keyboard.press('Control+z')
  check((await levels()) === 0, 'deshacer dos veces no dejó el gráfico como antes de dibujar')
})

await step('los atajos arman las herramientas y recorren la lista', async () => {
  await page.keyboard.press('Alt+t')
  check((await button('Trend line').getAttribute('aria-pressed')) === 'true', 'Alt+T no armó la línea de tendencia')
  await page.keyboard.press('Alt+h')
  check((await button('Horizontal line').getAttribute('aria-pressed')) === 'true', 'Alt+H no armó la línea horizontal')
  await page.keyboard.press('Escape')
  check((await button('Cursor').getAttribute('aria-pressed')) === 'true', 'Esc no devolvió el cursor')
  await page.keyboard.press('ArrowDown')
  await page.getByText(/Microsoft Corporation · 1D/).waitFor({ timeout: 15_000 })
  await page.keyboard.press('ArrowUp')
  await page.getByText(/Apple Inc\. · 1D/).waitFor({ timeout: 15_000 })
  await page.keyboard.press('ArrowUp')
  await page.waitForTimeout(400)
  check((await savedState()).symbol === 'AAPL', 'la flecha arriba se salió del principio de la lista')
})

await step('Telegram se conecta con la clave de un bot, enlaza el chat y manda un mensaje de prueba', async () => {
  await button('Settings').click()
  await page.getByLabel('Bot token').fill('123456789:AAbbCCddEEffGGhhIIjjKKllMMnnOOppQQ')
  await button('Connect').click()
  await page.getByText(`@${FAKE_BOT} connected`, { exact: false }).waitFor({ timeout: 5000 })
  await button('Link chat').click()
  await page.getByText(`Alerts go to @${FAKE_BOT}.`).waitFor({ timeout: 5000 })
  await button('Send test message').click()
  await page.getByRole('status').filter({ hasText: 'Test message sent.' }).waitFor({ timeout: 5000 })
  check(
    telegramMessages.some((message) => message.chat === FAKE_CHAT && String(message.text).startsWith('doji is connected')),
    `el mensaje de prueba no llegó a Telegram: ${JSON.stringify(telegramMessages)}`,
  )
  await page.keyboard.press('Escape')
})

await step('una alerta la decide el servidor: avisa en pantalla y por Telegram y se desarma sola', async () => {
  const { price } = await panes()
  const levels = async () => (await drawingsOf('AAPL')).filter((drawing) => drawing.kind === 'hline')
  await pickTool('Horizontal line')
  await page.mouse.click(...at(price, 0.4, 0.3))
  const [placed] = await levels()
  check(placed !== undefined, 'la línea de la alerta no se guardó')
  const target = placed?.kind === 'hline' ? placed.value : 0
  await button('Alert').click()
  const [armed] = await levels()
  check(armed?.kind === 'hline' && armed.alert === true, 'la alerta no se guardó')
  const feed = (value: number) =>
    page.evaluate(
      async (prices) =>
        (await fetch('/api/test/prices', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(prices) })).json(),
      { AAPL: value },
    )
  let answer = { fired: [] as unknown[] }
  for (let attempt = 0; attempt < 3 && answer.fired.length === 0; attempt += 1) {
    const down = (await feed(target - 1)) as { fired: unknown[] }
    const up = (await feed(target + 1)) as { fired: unknown[] }
    answer = down.fired.length > 0 ? down : up
  }
  check(answer.fired.length === 1, `el servidor no hizo saltar la alerta: ${JSON.stringify(answer)}`)
  await page.getByRole('status').filter({ hasText: 'AAPL crossed' }).first().waitFor({ timeout: 10_000 })
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline && !telegramMessages.some((message) => String(message.text).includes('AAPL crossed'))) await page.waitForTimeout(200)
  check(telegramMessages.some((message) => String(message.text).startsWith('🔔 AAPL crossed')), 'la alerta no llegó por Telegram')
  const [after] = await levels()
  check(after?.kind === 'hline' && after.alert === undefined, 'la alerta no se desarmó al saltar')
  check((await feed(target - 2)).fired.length === 0 && (await feed(target + 2)).fired.length === 0, 'la alerta saltó otra vez después de desarmarse')
  await page.getByRole('button', { name: /^Dismiss AAPL crossed/ }).first().click()
  check((await page.getByRole('status').filter({ hasText: 'AAPL crossed' }).count()) === 0, 'el aviso no se cerró')
  await page.reload()
  await waitForChart()
  await page.mouse.click(price.x + price.width * 0.15, price.y + price.height * 0.3)
  await page.keyboard.press('Delete')
  check((await levels()).length === 0, 'la línea de la alerta no se borró')
})

await step('una alerta sobre un indicador salta en el servidor cuando el día se mueve más de lo pedido', async () => {
  const symbol = (await savedState()).symbol
  await button('Alerts').click()
  await page.getByRole('combobox', { name: 'Condition' }).selectOption('move')
  await page.getByRole('spinbutton', { name: 'Value' }).fill('2')
  await page.getByRole('button', { name: 'Add alert' }).click()
  await page.keyboard.press('Escape')
  const [alert] = (await savedState()).indicatorAlerts[symbol] ?? []
  check(alert?.kind === 'move' && alert.value === 2 && alert.armed, `la alerta del indicador no se guardó: ${JSON.stringify(alert)}`)
  check((await button(/^Alerts, 1 armed$/).count()) === 1, 'la campana no cuenta la alerta armada')
  const history = (await page.evaluate(async (wanted) => (await fetch(`/api/history?symbol=${wanted}`)).json(), symbol)) as History
  const bars = history.bars
  const session = sessionDayOf(bars[bars.length - 1].time, history.timezone, Date.now(), tradesOnWeekends(bars.map((bar) => bar.time)))
  const previous = bars[session === bars[bars.length - 1].time ? bars.length - 2 : bars.length - 1].close
  const feed = (value: number) =>
    page.evaluate(
      async (prices) =>
        (await fetch('/api/test/prices', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(prices) })).json(),
      { [symbol]: value },
    )
  const firedAlready = async () => (await savedState()).indicatorAlerts[symbol]?.[0]?.armed === false
  let answer = { fired: [] as unknown[] }
  for (let attempt = 0; attempt < 3 && answer.fired.length === 0 && !(await firedAlready()); attempt += 1) {
    await feed(previous * 1.001)
    answer = (await feed(previous * 1.04)) as { fired: unknown[] }
  }
  check(answer.fired.length === 1 || (await firedAlready()), `el servidor no hizo saltar la alerta del indicador: ${JSON.stringify(answer)}`)
  await page.getByRole('status').filter({ hasText: `${symbol}: Day move beyond 2%` }).first().waitFor({ timeout: 10_000 })
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline && !telegramMessages.some((message) => String(message.text).includes('Day move beyond 2%'))) await page.waitForTimeout(200)
  check(telegramMessages.some((message) => String(message.text).startsWith(`🔔 ${symbol}: Day move beyond 2%`)), 'la alerta del indicador no llegó por Telegram')
  check((await savedState()).indicatorAlerts[symbol]?.[0]?.armed === false, 'la alerta del indicador no se desarmó al saltar')
  await page.getByRole('button', { name: new RegExp(`^Dismiss ${symbol}: Day move`) }).first().click()
  await button('Alerts').click()
  await page.getByRole('button', { name: 'Remove alert Day move beyond 2%' }).click()
  await page.keyboard.press('Escape')
  check(!(symbol in (await savedState()).indicatorAlerts), 'la alerta del indicador no se quitó')
})

await step('con la clave de reserva, Twelve Data entra cuando Yahoo falla tres veces seguidas y el gráfico lo dice', async () => {
  const before = (await savedState()).symbol
  await button('Settings').click()
  await page.getByLabel('Twelve Data key').fill('abcdef0123456789')
  await button('Save key').click()
  await page.getByText('Twelve Data steps in when Yahoo fails three times in a row.').waitFor({ timeout: 5000 })
  await page.keyboard.press('Escape')
  const yahoo = (down: boolean) =>
    fetch(`${url}/api/test/yahoo`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ down }) })
  await yahoo(true)
  const sources: (string | null)[] = []
  for (const symbol of ['IBM', 'ORCL', 'INTC', 'CSCO']) {
    const response = await fetch(`${url}/api/history?symbol=${symbol}`)
    sources.push(response.ok ? ((await response.json()) as { source?: string }).source ?? 'Yahoo' : null)
  }
  const switched = sources.indexOf('Twelve Data')
  check(switched > 0 && sources.slice(0, switched).every((source) => source === null), `la reserva no entró tras los fallos de Yahoo: ${JSON.stringify(sources)}`)
  const state = await savedState()
  await fetch(`${url}/api/state`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...state, symbol: 'CSCO' }) })
  await page.reload()
  await page.getByText('Data from Twelve Data: Yahoo is not answering').waitFor({ timeout: 15_000 })
  await yahoo(false)
  const latest = await savedState()
  await fetch(`${url}/api/state`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...latest, symbol: before }) })
  await page.reload()
  await waitForChart()
  await button('Settings').click()
  await button('Remove key').click()
  await page.getByLabel('Twelve Data key').waitFor({ timeout: 5000 })
  await page.keyboard.press('Escape')
})

await step('la cinta de mercados da precio y cambio del día, abre su gráfico, se edita y se oculta', async () => {
  const before = await savedState()
  const strip = page.getByRole('region', { name: 'Market ticker' })
  await strip.waitFor({ timeout: 5000 })
  const names = await strip.getByRole('button').evaluateAll((buttons) => buttons.map((item) => item.getAttribute('aria-label') ?? ''))
  check(
    JSON.stringify(names.map((name) => name.split(' ')[0])) === JSON.stringify(['S&P', 'Nasdaq', 'VIX', 'EUR/USD', 'Gold', 'Bitcoin', 'Edit']),
    `la cinta no trae los seis mercados: ${JSON.stringify(names)}`,
  )
  await strip.getByRole('button', { name: /^S&P 500 [\d,]+\.\d{2} [+−]?\d+\.\d{2}%$/ }).waitFor({ timeout: 20_000 })
  await strip.getByRole('button', { name: /^Bitcoin [\d,]+\.\d{2} [+−]?\d+\.\d{2}%$/ }).waitFor({ timeout: 20_000 })
  await strip.getByRole('button', { name: /^Bitcoin / }).click()
  await strip.locator('button[aria-current="true"]', { hasText: 'Bitcoin' }).waitFor({ timeout: 5000 })
  await page.waitForFunction(() => document.title.startsWith('BTC-USD '), undefined, { timeout: 15_000 })
  await button('Edit ticker').click()
  await button('Remove VIX from the ticker').click()
  await button('Add to ticker').click()
  await page.getByPlaceholder('Search symbol or company').fill('NFLX')
  await page.getByRole('option').filter({ hasText: 'Netflix' }).first().click()
  await button('Done').click()
  await strip.getByRole('button', { name: /^NFLX / }).waitFor({ timeout: 5000 })
  const savedTicker = async (done: (ticker: AppState['ticker']) => boolean): Promise<AppState['ticker']> => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const { ticker } = await savedState()
      if (done(ticker)) return ticker
      await page.waitForTimeout(250)
    }
    return (await savedState()).ticker
  }
  const edited = await savedTicker((ticker) => ticker.items.some((item) => item.symbol === 'NFLX'))
  check(
    JSON.stringify(edited.items.map((item) => item.symbol)) === JSON.stringify(['^GSPC', '^IXIC', 'EURUSD=X', 'GC=F', 'BTC-USD', 'NFLX']),
    `la cinta editada no se guardó: ${JSON.stringify(edited.items)}`,
  )
  await button('Edit ticker').click()
  await button('Hide ticker').click()
  await strip.waitFor({ state: 'detached', timeout: 5000 })
  check((await savedTicker((ticker) => !ticker.visible)).visible === false, 'la cinta oculta no se guardó')
  await page.reload()
  await waitForChart()
  check((await page.getByRole('region', { name: 'Market ticker' }).count()) === 0, 'la cinta oculta volvió al recargar')
  await button('Settings').click()
  await page.getByRole('checkbox', { name: 'Market ticker' }).check()
  await page.keyboard.press('Escape')
  await strip.getByRole('button', { name: /^NFLX / }).waitFor({ timeout: 5000 })
  const latest = await savedState()
  await fetch(`${url}/api/state`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...latest, symbol: before.symbol, ticker: before.ticker }),
  })
  await page.reload()
  await waitForChart()
})

await step('dos gráficos a la vez con periodos distintos y los mismos dibujos', async () => {
  const charts = page.locator('.tv-lightweight-charts')
  const picker = page.getByRole('group', { name: 'Second chart timeframe' })
  const levels = async () => (await drawingsOf('AAPL')).filter((drawing) => drawing.kind === 'hline')
  check((await charts.count()) === 1, 'hay más de un gráfico antes de dividir')
  await button('Two charts').click()
  await page.getByText(/ · 1W · /).waitFor({ timeout: 10_000 })
  check((await charts.count()) === 2, 'no hay dos gráficos')
  check(await page.getByText(/ · 1D · /).isVisible(), 'el primer gráfico dejó de ser diario')
  check((await savedState()).secondChart === 'W', 'el segundo gráfico no se guardó')
  await picker.getByRole('button', { name: 'M' }).click()
  await page.getByText(/ · 1M · /).waitFor({ timeout: 10_000 })
  check((await savedState()).secondChart === 'M', 'el periodo del segundo gráfico no se guardó')
  const second = (await charts.nth(1).boundingBox()) as Box
  await pickTool('Horizontal line')
  await page.mouse.click(second.x + second.width * 0.4, second.y + second.height * 0.3)
  const [drawn] = await levels()
  check(drawn !== undefined && drawn.timeframe === 'M', 'la línea dibujada en el segundo gráfico no se guardó con su periodo')
  const first = (await charts.nth(0).boundingBox()) as Box
  await pickTool('Horizontal line')
  await page.mouse.click(first.x + first.width * 0.4, first.y + first.height * 0.2)
  check((await levels()).length === 2, 'la línea del primer gráfico no se guardó')
  check((await page.getByRole('toolbar', { name: 'Selected line' }).count()) === 1, 'quedó un dibujo seleccionado en cada gráfico')
  await page.keyboard.press('Delete')
  const kept = await levels()
  check(kept.length === 1 && kept[0].id === drawn?.id, 'Supr borró más de un dibujo o el que no era')
  await page.mouse.click(second.x + second.width * 0.2, second.y + second.height * 0.3)
  await page.keyboard.press('Delete')
  check((await levels()).length === 0, 'la línea del segundo gráfico no se borró')
  await page.reload()
  await waitForChart()
  check((await charts.count()) === 2, 'los dos gráficos no volvieron tras recargar')
  await button('Two charts').click()
  await page.waitForTimeout(500)
  check((await charts.count()) === 1, 'el segundo gráfico no se cerró')
  check((await savedState()).secondChart === null, 'el cierre del segundo gráfico no se guardó')
})

await step('la vista no salta al cambiar de tema y volver', async () => {
  const before = await timeAxisPixels()
  await chooseTheme('Light')
  await page.waitForTimeout(100)
  await chooseTheme('Midnight')
  const after = await timeAxisPixels()
  check(before === after, 'la vista volvió a la última vela')
})

await step('la vista no salta al quitar y poner el volumen', async () => {
  const before = await timeAxisPixels()
  await button('Indicators').click()
  await page.getByRole('checkbox', { name: 'Volume', exact: true }).click()
  await page.waitForTimeout(400)
  await page.getByRole('checkbox', { name: 'Volume', exact: true }).click()
  await page.keyboard.press('Escape')
  const after = await timeAxisPixels()
  check(before === after, 'la vista volvió a la última vela')
})

await step('cambia de tema', async () => {
  const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  const dark = await background()
  await chooseTheme('Light')
  check((await background()) !== dark, 'el fondo no cambió')
  check((await savedState()).theme === 'light', 'el tema no se guardó')
})

await step('cambiar a una acción de la lista no espera a la fuente', async () => {
  const fresh = /\/api\/history\?symbol=NVDA$/
  let held = 0
  await page.route(fresh, async (route) => {
    held += 1
    await new Promise((resolve) => setTimeout(resolve, 4000))
    await route.continue()
  })
  const started = Date.now()
  await row('NVDA').click()
  await page.getByText(/NVIDIA Corporation · 1D/).waitFor({ timeout: 2000 })
  const shown = Date.now() - started
  check((await page.getByRole('status').filter({ hasText: 'Loading' }).count()) === 0, 'apareció el aviso de carga')
  check(held >= 1, 'no se pidieron los datos frescos por detrás')
  console.log(`       NVDA en pantalla en ${shown} ms con la fuente retenida 4 s`)
  await page.waitForTimeout(4500)
  await page.unrouteAll({ behavior: 'wait' })
  check((await savedState()).symbol === 'NVDA', 'el símbolo no se guardó')
})

await step('cambia de acción desde la lista', async () => {
  const { price } = await panes()
  const start = at(price, 0.8, 0.15)
  await drag(start, [start[0], start[1] + 60])
  await button('Auto').waitFor({ timeout: 3000 })
  await row('MSFT').click()
  await page.getByText(/Microsoft Corporation · 1D/).waitFor({ timeout: 15_000 })
  await page.waitForTimeout(800)
  check((await button('Auto').count()) === 0, 'el ajuste automático no volvió al cambiar de acción')
  const state = await savedState()
  check(state.symbol === 'MSFT', 'el símbolo no se guardó')
  await page.waitForFunction(() => document.title.startsWith('MSFT '), undefined, { timeout: 5000 })
  const title = await page.title()
  check(/^MSFT [\d,]+\.\d{2}( [▲▼])? [+−]?\d+\.\d{2}%$/.test(title), `título de la pestaña inesperado: ${title}`)
  check(state.lines.MSFT === undefined, 'MSFT tiene líneas que no se dibujaron')
})

await step('cada acción recuerda su vista al volver a ella, también tras recargar', async () => {
  const { price } = await panes()
  const symbol = (await savedState()).symbol
  const settle = async (): Promise<void> => {
    await page.mouse.move(700, 10)
    await page.waitForTimeout(500)
  }
  await page.mouse.move(...at(price, 0.5, 0.5))
  await page.mouse.wheel(0, 500)
  await page.waitForTimeout(300)
  await drag(at(price, 0.4, 0.55), at(price, 0.75, 0.55))
  const start = at(price, 0.85, 0.2)
  await drag(start, [start[0], start[1] + 70])
  await button('Auto').waitFor({ timeout: 3000 })
  const existing = (await drawingsOf(symbol)).map((drawing) => drawing.id)
  await pickTool('Horizontal line')
  await page.mouse.click(...at(price, 0.5, 0.5))
  await settle()
  const reference = (await drawingsOf(symbol)).find((drawing) => !existing.includes(drawing.id))
  check(reference?.kind === 'hline', 'la línea de referencia no se guardó')
  const axis = await timeAxisPixels()
  const line = await blueCentre(price)
  check(line !== null, 'no se encontró la línea de referencia')
  const sameView = async (moment: string): Promise<void> => {
    await settle()
    check((await timeAxisPixels()) === axis, `${moment}: el eje de fechas no es el que se dejó`)
    check((await button('Auto').count()) === 1, `${moment}: se perdió el desplazamiento vertical`)
    const back = await blueCentre(price)
    check(back !== null && Math.abs(back[1] - (line as [number, number])[1]) <= 1, `${moment}: la línea cambió de altura`)
  }
  await row('AAPL').click()
  await page.getByText(/Apple Inc\. · 1D/).waitFor({ timeout: 15_000 })
  await settle()
  check((await button('Auto').count()) === 0, 'AAPL heredó el desplazamiento vertical de otra acción')
  check((await timeAxisPixels()) !== axis, 'AAPL heredó el tramo de fechas de otra acción')
  await row(symbol).click()
  await page.waitForFunction((wanted) => document.title.startsWith(`${wanted} `), symbol, { timeout: 15_000 })
  await sameView('al volver')
  await page.reload()
  await waitForChart()
  await sameView('tras recargar')
  const placed = await blueCentre(price)
  await page.mouse.click(price.x + price.width * 0.15, (placed as [number, number])[1])
  await page.keyboard.press('Delete')
  check(!(await drawingsOf(symbol)).some((drawing) => drawing.id === reference?.id), 'la línea de referencia no se borró')
  check((await button('Auto').count()) === 1, 'se perdió el desplazamiento vertical antes de cambiar de periodo')
  await button('W').click()
  await page.getByText(/ · 1W · /).waitFor({ timeout: 10_000 })
  await settle()
  check((await button('Auto').count()) === 0, 'la escala de precios siguió fija al cambiar de periodo')
  await button('D').click()
  await page.getByText(/ · 1D · /).waitFor({ timeout: 10_000 })
  await settle()
})

await step('añade KO y PEP seguidos sin cerrar el buscador ni cambiar el gráfico', async () => {
  const onScreen = (await savedState()).symbol
  const field = page.getByPlaceholder('Search symbol or company')
  await button('Add symbol').click()
  await field.fill('KO')
  await page.getByRole('option').filter({ hasText: 'Coca-Cola' }).first().click()
  await row('KO').waitFor({ timeout: 15_000 })
  await page.getByText('KO added. Type another ticker, or press Esc to finish.').waitFor({ timeout: 3000 })
  await field.fill('PEP')
  await page.getByRole('option').filter({ hasText: 'PepsiCo' }).first().waitFor({ timeout: 15_000 })
  await page.keyboard.press('Enter')
  await row('PEP').waitFor({ timeout: 15_000 })
  check(await page.getByRole('dialog', { name: 'Symbol search' }).isVisible(), 'el buscador se cerró al añadir')
  await page.keyboard.press('Escape')
  const state = await savedState()
  check(['KO', 'PEP'].every((symbol) => activeItems(state).some((item) => item.symbol === symbol)), 'KO y PEP no están en la lista')
  check(state.symbol === onScreen, `el gráfico cambió a ${state.symbol} al añadir`)
})

await step('quita KO y PEP de la lista', async () => {
  for (const symbol of ['KO', 'PEP']) {
    await row(symbol).hover()
    await button(`Remove ${symbol}`).click()
  }
  const items = activeItems(await savedState())
  check(!items.some((item) => item.symbol === 'KO' || item.symbol === 'PEP'), 'KO o PEP siguen en la lista')
})

await step('un par de divisas se busca, se añade y se ve como en TradingView', async () => {
  const before = (await savedState()).symbol
  await button('Add symbol').click()
  await page.getByPlaceholder('Search symbol or company').fill('EURUSD')
  const option = page.getByRole('option').filter({ hasText: 'Forex' }).filter({ hasText: /^EURUSD/ }).first()
  await option.waitFor({ timeout: 15_000 })
  check(!(await option.textContent())?.includes('=X'), 'el buscador enseña el símbolo de Yahoo')
  await option.click()
  await row('EURUSD').waitFor({ timeout: 5000 })
  await page.keyboard.press('Escape')
  await row('EURUSD').click()
  await page.getByText(/EUR\/USD · 1D · Forex/).waitFor({ timeout: 15_000 })
  check(activeItems(await savedState()).some((item) => item.symbol === 'EURUSD=X'), 'el par no se guardó con su símbolo de Yahoo')
  await page.waitForFunction(() => document.title.startsWith('EURUSD '), undefined, { timeout: 5000 })
  check(/^EURUSD \d\.\d{4}( [▲▼])? [+−]?\d+\.\d{2}%$/.test(await page.title()), `título del par inesperado: ${await page.title()}`)
  check((await row('EURUSD').locator('[data-currency]').count()) === 2, 'el par no muestra sus dos banderas')
  await row('EURUSD').getByText(/^\d\.\d{4}$/).first().waitFor({ timeout: 20_000 })
  await row('EURUSD').hover()
  await button('Remove EURUSD').click()
  check(!activeItems(await savedState()).some((item) => item.symbol === 'EURUSD=X'), 'el par sigue en la lista')
  await row(before).click()
  await page.waitForFunction((symbol) => document.title.startsWith(`${symbol} `), before, { timeout: 15_000 })
})

await step('una criptomoneda, un índice y un futuro se buscan, se añaden y se abren', async () => {
  const before = (await savedState()).symbol
  const cases: [string, string, RegExp][] = [
    ['bitcoin', 'BTC-USD', /Bitcoin USD · 1D · Crypto/],
    ['S&P 500', '^GSPC', /S&P 500 · 1D · /],
    ['crude oil', 'CL=F', /Crude Oil .* · 1D · /],
  ]
  for (const [query, symbol, title] of cases) {
    await button('Add symbol').click()
    await page.getByPlaceholder('Search symbol or company').fill(query)
    const option = page.getByRole('option').filter({ hasText: symbol }).first()
    await option.waitFor({ timeout: 15_000 })
    await option.click()
    await row(symbol.replace('^', '\\^')).waitFor({ timeout: 5000 })
    await page.keyboard.press('Escape')
    await row(symbol.replace('^', '\\^')).click()
    await page.getByText(title).first().waitFor({ timeout: 20_000 })
  }
  const bitcoin = await page.evaluate(async () => (await fetch('/api/history?symbol=BTC-USD')).json())
  const weekends = (bitcoin.bars as { time: string }[]).filter((bar) => [0, 6].includes(new Date(`${bar.time}T00:00:00Z`).getUTCDay()))
  check(weekends.length > 0, 'el histórico de bitcoin no trae fines de semana')
  for (const [, symbol] of cases) {
    await row(symbol.replace('^', '\\^')).hover()
    await button(`Remove ${symbol}`).click()
  }
  await row(before).click()
  await page.waitForFunction((wanted) => document.title.startsWith(`${wanted} `), before, { timeout: 15_000 })
})

await step('Enter antes de que lleguen los resultados elige el primero', async () => {
  const before = activeItems(await savedState()).map((item) => item.symbol)
  await button('Add symbol').click()
  await page.getByPlaceholder('Search symbol or company').pressSequentially('KO')
  await page.keyboard.press('Enter')
  await row('KO').waitFor({ timeout: 15_000 })
  await page.keyboard.press('Escape')
  const added = activeItems(await savedState())
    .map((item) => item.symbol)
    .filter((symbol) => !before.includes(symbol))
  check(added.length === 1, `se esperaba un símbolo nuevo y hay ${added.length}`)
  check(added[0] === 'KO', `se eligió ${added[0]} en lugar del primer resultado de KO`)
  await row('KO').hover()
  await button('Remove KO').click()
  check(!activeItems(await savedState()).some((item) => item.symbol === 'KO'), 'KO sigue en la lista')
})

await step('reordena la lista arrastrando una fila', async () => {
  const before = activeItems(await savedState()).map((item) => item.symbol)
  const last = before[before.length - 1]
  await page.getByRole('listitem').filter({ hasText: last }).dragTo(page.getByRole('listitem').filter({ hasText: before[0] }))
  const after = activeItems(await savedState()).map((item) => item.symbol)
  check(after[0] === last, `la fila ${last} no pasó al principio: ${after.join(',')}`)
  check([...after].sort().join(',') === [...before].sort().join(','), 'la lista perdió o ganó símbolos al reordenar')
})

await step('ordena la lista por cambio, lo invierte, lo recuerda y vuelve al orden propio', async () => {
  const manual = activeItems(await savedState()).map((item) => item.symbol)
  const changes = async (): Promise<number[]> =>
    (await page.locator('aside li button > div:nth-child(3)').allTextContents()).map((text) =>
      Number(text.replace('−', '-').replace('%', '')),
    )
  const shownSymbols = async (): Promise<string[]> =>
    (await page.getByRole('button', { name: /^Remove / }).evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label') ?? ''))).map(
      (label) => label.replace('Remove ', ''),
    )
  const ordered = (values: number[], direction: number): boolean => values.every((value, index) => index === 0 || (value - values[index - 1]) * direction <= 0)
  await page.waitForFunction(() => [...document.querySelectorAll('aside li button > div:nth-child(3)')].every((cell) => cell.textContent !== '—'), undefined, { timeout: 20_000 })
  const changeHeader = button(/^Sort by Chg%/)
  await changeHeader.click()
  check((await changeHeader.textContent()) === 'Chg% ▼', 'la cabecera no marca el orden descendente')
  check((await changeHeader.getAttribute('aria-label')) === 'Sort by Chg%, highest first', 'la cabecera no dice el sentido del orden')
  check(ordered(await changes(), 1), `la lista no quedó de mayor a menor: ${await changes()}`)
  await changeHeader.click()
  check(ordered(await changes(), -1), `la lista no quedó de menor a mayor: ${await changes()}`)
  check(JSON.stringify((await savedState()).watchlistSort) === JSON.stringify({ column: 'change', direction: 'asc' }), 'el orden no se guardó')
  await page.reload()
  await waitForChart()
  await page.waitForFunction(() => [...document.querySelectorAll('aside li button > div:nth-child(3)')].every((cell) => cell.textContent !== '—'), undefined, { timeout: 20_000 })
  check(ordered(await changes(), -1), 'el orden no se mantuvo al recargar')
  check(activeItems(await savedState()).map((item) => item.symbol).join() === manual.join(), 'ordenar cambió el orden guardado de la lista')
  await changeHeader.click()
  check((await savedState()).watchlistSort === null, 'el tercer clic no quitó el orden')
  check((await shownSymbols()).join() === manual.join(), `no volvió al orden propio: ${await shownSymbols()}`)
})

await step('añade columnas a la lista, las rellena, ordena por una y las quita', async () => {
  const before = await savedState()
  const cells = (child: number) => page.locator(`aside li button > div:nth-child(${child})`)
  await button('Columns').click()
  const menu = page.getByRole('group', { name: 'Columns' })
  await menu.getByRole('checkbox', { name: 'RSI 14' }).click()
  await menu.getByRole('checkbox', { name: 'Next earnings' }).click()
  await page.keyboard.press('Escape')
  check((await menu.count()) === 0, 'Esc no cerró el menú de columnas')
  const picked = await savedState()
  check(JSON.stringify(picked.watchlistColumns) === JSON.stringify(['rsi', 'earnings']), `no se guardaron las columnas: ${picked.watchlistColumns}`)
  check(picked.listWidth === before.listWidth + 128, `la lista no se ensanchó para las columnas: ${picked.listWidth}`)
  await page.waitForFunction(
    () => [...document.querySelectorAll('aside li button > div:nth-child(5)')].every((cell) => cell.textContent !== '—'),
    undefined,
    { timeout: 90_000 },
  )
  const strengths = (await cells(5).allTextContents()).map(Number)
  check(strengths.length > 0 && strengths.every((value) => value >= 0 && value <= 100), `RSI fuera de rango: ${strengths}`)
  check((await cells(6).allTextContents()).some((text) => /^~?[A-Z][a-z]{2} \d{1,2}$/.test(text)), 'ninguna fecha de resultados en la lista')
  await button('Sort by RSI 14').click()
  const sorted = (await cells(5).allTextContents()).map(Number)
  check(sorted.every((value, index) => index === 0 || value <= sorted[index - 1]), `la lista no quedó por RSI de mayor a menor: ${sorted}`)
  await button('Columns').click()
  await menu.getByRole('checkbox', { name: 'RSI 14' }).click()
  await menu.getByRole('checkbox', { name: 'Next earnings' }).click()
  await page.keyboard.press('Escape')
  const after = await savedState()
  check(after.watchlistColumns.length === 0 && after.listWidth === before.listWidth, 'quitar las columnas no devolvió la lista a como estaba')
  check(after.watchlistSort === null, 'quitar la columna no quitó su orden')
})

await step('una bandera de color marca la acción en todas sus listas, ordena y filtra la lista', async () => {
  const symbols = activeItems(await savedState()).map((item) => item.symbol)
  const [first, second] = symbols
  await row(first).hover()
  await button(`Flag ${first}`).click()
  await page.getByRole('group', { name: 'Flag colour' }).getByRole('button', { name: 'Purple' }).click()
  check((await savedState()).flags[first] === 'purple', 'la bandera no se guardó')
  check((await button(`Flag ${first}`).getAttribute('title')) === 'Purple flag', 'la fila no enseña su bandera')
  await button(/^Sort by Flag/).click()
  check((await page.getByRole('button', { name: /^Remove / }).first().getAttribute('aria-label')) === `Remove ${first}`, 'la acción con bandera no subió al ordenar')
  await button(/^Sort by Flag/).click()
  await button(/^Sort by Flag/).click()
  check((await savedState()).watchlistSort === null, 'no volvió al orden propio')
  await button('Columns').click()
  await page.getByRole('checkbox', { name: 'Only flagged symbols' }).click()
  await page.keyboard.press('Escape')
  check((await page.getByRole('button', { name: /^Remove / }).count()) === 1, 'el filtro no dejó solo la acción con bandera')
  check(await row(second).isHidden(), `${second} sigue a la vista sin bandera`)
  await button('Columns').click()
  await page.getByRole('checkbox', { name: 'Only flagged symbols' }).click()
  await page.keyboard.press('Escape')
  await row(second).waitFor({ timeout: 3000 })
  await row(first).hover()
  await button(`Flag ${first}`).click()
  await page.getByRole('button', { name: 'No flag' }).click()
  const after = await savedState()
  check(!(first in after.flags) && !after.onlyFlagged, 'la bandera o el filtro no se quitaron')
})

await step('un filtro guardado deja en la lista lo que cumple sus condiciones, en una lista o en todas, y se guarda como lista', async () => {
  const symbols = activeItems(await savedState()).map((item) => item.symbol)
  const total = symbols.length
  const counted = (text: string) => page.getByText(text, { exact: true }).waitFor({ timeout: 90_000 })
  await button('Filter').click()
  await page.getByRole('menuitem', { name: 'New filter…' }).click()
  const dialog = page.getByRole('dialog', { name: 'New filter' })
  await dialog.getByRole('textbox', { name: 'Filter name' }).fill('Prueba RSI')
  await dialog.getByRole('spinbutton', { name: 'Value' }).fill('101')
  await dialog.getByRole('button', { name: 'Save' }).click()
  const saved = await savedState()
  check(saved.filters.length === 1 && saved.activeFilterId === saved.filters[0].id, 'el filtro no se guardó ni se aplicó')
  await counted(`${total} of ${total}`)
  await button('Edit filter').click()
  const editor = page.getByRole('dialog', { name: 'Edit filter' })
  await editor.getByRole('combobox', { name: 'Comparison' }).selectOption('above')
  await editor.getByRole('button', { name: 'Save' }).click()
  await counted(`0 of ${total}`)
  await page.getByText('No symbols match this filter').waitFor({ timeout: 3000 })
  await button('Edit filter').click()
  await editor.getByRole('combobox', { name: 'Comparison' }).selectOption('below')
  await editor.getByRole('radio', { name: 'All watchlists' }).check()
  await editor.getByRole('button', { name: 'Save' }).click()
  await counted(`${total} of ${total}`)
  check((await page.getByRole('button', { name: /^Remove / }).count()) === 0, 'con todas las listas se puede quitar un símbolo')
  await button('Save as list').click()
  const listed = await savedState()
  const created = listed.watchlists.find((list) => list.name === 'Prueba RSI')
  check(created !== undefined && listed.activeWatchlistId === created.id, 'no se creó ni abrió la lista del filtro')
  check(symbolsOf(created?.items ?? []).length === total, 'la lista del filtro no tiene sus símbolos')
  check(listed.activeFilterId === null, 'el filtro siguió aplicado tras guardarlo como lista')
  await button('Watchlists').click()
  await button('Delete Prueba RSI').click()
  await button('Confirm deleting Prueba RSI').click()
  await page.keyboard.press('Escape')
  await button('Filter').click()
  await page.getByRole('menuitem', { name: 'Prueba RSI · all watchlists' }).click()
  await button('Edit filter').click()
  await editor.getByRole('button', { name: 'Delete filter' }).click()
  const after = await savedState()
  check(after.filters.length === 0 && after.activeFilterId === null && after.watchlists.length === 1, 'no quedó todo como estaba')
})

await step('una posición guarda acciones y precio medio, pinta su línea y su ganancia, y suma el total de la lista', async () => {
  const symbol = (await savedState()).symbol
  const before = await savedState()
  const { price } = await panes()
  const clean = await regionShot(price)
  await button(`Position in ${symbol}`).click()
  const [quote] = await page.evaluate(async (wanted) => (await fetch(`/api/quotes?symbols=${wanted}`)).json(), symbol)
  const average = Math.round(quote.price * 95) / 100
  await page.getByRole('spinbutton', { name: 'Shares' }).fill('10')
  await page.getByRole('spinbutton', { name: 'Average price' }).fill(String(average))
  await page.getByRole('spinbutton', { name: 'Average price' }).press('Enter')
  const held = await savedState()
  check(JSON.stringify(held.holdings[symbol]) === JSON.stringify({ quantity: 10, price: average }), `la posición no se guardó: ${JSON.stringify(held.holdings)}`)
  check(/[+−]\d/.test((await button(`Position in ${symbol}`).textContent()) ?? ''), 'el panel no dice la ganancia')
  check((await regionShot(price)) !== clean, 'la línea de la posición no se ve en el gráfico')
  await button('Columns').click()
  await page.getByRole('checkbox', { name: 'Position gain %' }).click()
  await page.getByRole('checkbox', { name: 'Position gain', exact: true }).click()
  await page.keyboard.press('Escape')
  const total = page.getByRole('status', { name: 'Total gain' })
  await total.waitFor({ timeout: 5000 })
  check(/[+−]/.test((await total.textContent()) ?? ''), 'el total de la lista no dice la ganancia')
  check(!held.shareHoldings, 'las posiciones se comparten con la IA sin pedirlo')
  await button(`Remove position`).click()
  await button('Columns').click()
  await page.getByRole('checkbox', { name: 'Position gain %' }).click()
  await page.getByRole('checkbox', { name: 'Position gain', exact: true }).click()
  await page.keyboard.press('Escape')
  await button(`Position in ${symbol}`).click()
  const after = await savedState()
  check(Object.keys(after.holdings).length === 0 && after.watchlistColumns.length === 0 && after.listWidth === before.listWidth, 'no quedó todo como estaba')
})

await step('la ficha de la empresa enseña sus cifras al abrir el panel', async () => {
  const symbol = (await savedState()).symbol
  await button(`Company sheet for ${symbol}`).click()
  await page.getByText('Market cap', { exact: true }).waitFor({ timeout: 20_000 })
  check((await page.getByText('52-week range', { exact: true }).count()) === 1, 'la ficha no da el rango de 52 semanas')
  check((await page.getByText('Sector', { exact: true }).count()) === 1, 'la ficha no da el sector')
  const sheet = await page.evaluate(async (wanted) => (await fetch(`/api/profile?symbol=${wanted}`)).json(), symbol)
  check(typeof sheet.marketCap === 'number' && sheet.marketCap > 0, `la ficha no trae la capitalización: ${JSON.stringify(sheet).slice(0, 200)}`)
  await button(`Company sheet for ${symbol}`).click()
  check((await page.getByText('Market cap', { exact: true }).count()) === 0, 'la ficha no se plegó')
})

await step('las noticias de la acción se abren en otra pestaña', async () => {
  const symbol = (await savedState()).symbol
  await button(`News for ${symbol}`).click()
  const first = page.getByRole('listitem').getByRole('link').first()
  await first.waitFor({ timeout: 20_000 })
  check(((await first.getAttribute('href')) ?? '').startsWith('https://'), 'el titular no enlaza a una web segura')
  check((await first.getAttribute('target')) === '_blank', 'el titular no se abre en otra pestaña')
  check((await page.getByText(/ · (just now|\d+[mhd] ago|[A-Z][a-z]{2} \d{1,2})$/).count()) > 0, 'los titulares no dicen su medio y cuándo salieron')
  await button(`News for ${symbol}`).click()
})

await step('el gráfico se ve en euros con el cambio de cada día y sus dibujos son aparte', async () => {
  const before = await savedState()
  const symbol = before.symbol
  const closeShown = async (at?: { x: number; y: number }): Promise<number> => {
    await page.mouse.move(at?.x ?? 700, at?.y ?? 10)
    await page.waitForTimeout(400)
    const row = (await page.getByText(/ · 1[DWM] · /).first().locator('..').innerText()).replace(/\s+/g, '')
    return Number((row.match(/C([\d,.]+)/)?.[1] ?? 'NaN').replace(/,/g, ''))
  }
  const pastBar = await (async () => {
    const { price } = await panes()
    return { x: price.x + price.width * 0.3, y: price.y + price.height * 0.5 }
  })()
  const dollars = await closeShown()
  const pastDollars = await closeShown(pastBar)
  await button('Chart').click()
  await page.getByRole('radio', { name: 'Euros' }).check()
  await page.keyboard.press('Escape')
  await page.getByText(/ · in EUR$/).waitFor({ timeout: 20_000 })
  check((await savedState()).chart.currency === 'EUR', 'la moneda del gráfico no se guardó')
  const euros = await closeShown()
  const rates = await page.evaluate(async () => (await fetch('/api/history?symbol=EURUSD=X')).json())
  const rate = rates.bars.at(-1).close
  check(Math.abs(euros - dollars / rate) / euros < 0.02, `el cierre en euros no cuadra: ${dollars} / ${rate} ≠ ${euros}`)
  const existing = (await drawingsOf(symbol)).map((drawing) => drawing.id)
  const { price } = await panes()
  await pickTool('Horizontal line')
  await page.mouse.click(price.x + price.width * 0.5, price.y + price.height * 0.4)
  await page.waitForTimeout(500)
  const drawn = (await drawingsOf(symbol)).find((drawing) => !existing.includes(drawing.id))
  check(drawn?.currency === 'EUR', `la línea hecha en euros no quedó marcada: ${JSON.stringify(drawn)}`)
  check((await page.getByRole('button', { name: 'Alert', exact: true }).count()) === 0, 'una línea en euros ofrece alerta')
  await page.keyboard.press('Delete')
  await button('Chart').click()
  await page.getByRole('radio', { name: 'Symbol currency' }).check()
  await page.keyboard.press('Escape')
  check((await page.getByText(/ · in EUR$/).count()) === 0, 'la leyenda sigue diciendo euros')
  check(Math.abs((await closeShown(pastBar)) - pastDollars) < 0.01, 'el gráfico no volvió a la moneda de la acción')
  const after = await savedState()
  check(after.chart.currency === 'original' && (after.lines[symbol] ?? []).length === existing.length, 'no quedó todo como estaba')
})

await step('los rangos rápidos cambian el tramo y ir a una fecha centra el gráfico en ella', async () => {
  await button('Show 1 month').click()
  const month = await timeAxisPixels()
  await button('Show 5 years').click()
  const years = await timeAxisPixels()
  check(month !== years, 'el eje de fechas no cambió entre 1M y 5Y')
  await button('Show 1 year').click()
  const year = await timeAxisPixels()
  const field = page.getByLabel('Go to date')
  await field.fill('2020-03-16')
  await field.press('Enter')
  const past = await timeAxisPixels()
  check(past !== year, 'ir a una fecha no movió el gráfico')
  await button('Show all').click()
  check((await timeAxisPixels()) !== past, 'All no enseñó toda la historia')
  await button('Show 1 year').click()
  check((await timeAxisPixels()) === year, '1Y no volvió al mismo tramo')
})

await step('oculta y muestra el RSI', async () => {
  await button('Indicators').click()
  await page.getByRole('checkbox', { name: 'RSI', exact: true }).click()
  await page.waitForTimeout(500)
  check((await page.getByText(/^RSI \d+ close$/).count()) === 0, 'la leyenda del RSI sigue visible')
  await page.getByRole('checkbox', { name: 'RSI', exact: true }).click()
  await page.getByText(/^RSI \d+ close$/).waitFor({ timeout: 3000 })
  await page.keyboard.press('Escape')
})

await step('añade dos medias móviles', async () => {
  await button('Indicators').click()
  await button('Add moving average').click()
  await button('Add moving average').click()
  await page.keyboard.press('Escape')
  const sma = (await savedState()).indicators.sma
  check(sma.map((item) => item.length).join(',') === '20,50', `periodos inesperados: ${sma.map((item) => item.length)}`)
  await page.getByText('SMA 20 close', { exact: true }).waitFor({ timeout: 3000 })
  await page.getByText('SMA 50 close', { exact: true }).waitFor({ timeout: 3000 })
})

await step('cambia el periodo de una media y quita la otra', async () => {
  await button('Indicators').click()
  await page.getByRole('spinbutton', { name: 'Length of average 2' }).fill('200')
  await button('Remove average 1').click()
  await page.keyboard.press('Escape')
  const sma = (await savedState()).indicators.sma
  check(sma.length === 1 && sma[0].length === 200, 'no quedó una única media de 200')
  await page.getByText('SMA 200 close', { exact: true }).waitFor({ timeout: 3000 })
  check((await page.getByText('SMA 20 close', { exact: true }).count()) === 0, 'la media de 20 sigue en la leyenda')
})

await step('muestra logos a círculo completo o con margen según su forma, y no la columna de cambio absoluto', async () => {
  await page.locator('li img[data-loaded="true"]').first().waitFor({ timeout: 30_000 })
  const logoOf = async (symbol: string) => {
    const image = row(symbol).locator('img[data-loaded="true"]')
    await image.waitFor({ timeout: 30_000 })
    return image.evaluate((node) => {
      const style = getComputedStyle(node)
      return `${(node as HTMLElement).dataset.shape} ${style.objectFit} ${style.paddingTop}`
    })
  }
  check((await logoOf('AAPL')) === 'tile cover 0px', `el logo de AAPL no llena el círculo: ${await logoOf('AAPL')}`)
  const fund = await logoOf('SPY')
  check(fund.startsWith('mark contain ') && !fund.endsWith(' 0px'), `el logo de SPY perdió su margen: ${fund}`)
  check((await page.getByText('Cambio', { exact: true }).count()) === 0, 'la columna Cambio sigue visible')
  check((await page.getByText('Chg%', { exact: true }).count()) === 1, 'falta la columna Cambio %')
})

await step('una media pasa a exponencial y vuelve a simple', async () => {
  const toggleType = async (): Promise<void> => {
    await button('Indicators').click()
    await button('Type of average 1').click()
    await page.keyboard.press('Escape')
  }
  await toggleType()
  check((await savedState()).indicators.sma[0]?.kind === 'ema', 'la media no pasó a exponencial')
  await page.getByText(/^EMA \d+ close$/).waitFor({ timeout: 3000 })
  await toggleType()
  check((await savedState()).indicators.sma[0]?.kind === undefined, 'la media no volvió a simple')
  await page.getByText(/^SMA \d+ close$/).waitFor({ timeout: 3000 })
})

await step('Bollinger, la media del volumen y el MACD se pintan, conviven con el RSI y se apagan', async () => {
  const rsiLegend = page.getByText(/^RSI \d+ close$/)
  const macdLegend = page.getByText('MACD 12 26 9', { exact: true })
  const toggle = async (names: string[]): Promise<void> => {
    await button('Indicators').click()
    for (const name of names) await page.getByRole('checkbox', { name, exact: true }).click()
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
  }
  const macdBelowRsi = async (): Promise<boolean> => {
    const rsiBox = await rsiLegend.boundingBox()
    const macdBox = await macdLegend.boundingBox()
    return rsiBox !== null && macdBox !== null && macdBox.y > rsiBox.y + 40
  }
  await toggle(['Volume moving average', 'Bollinger Bands', 'MACD'])
  await page.getByText('BB 20 2', { exact: true }).waitFor({ timeout: 3000 })
  await macdLegend.waitFor({ timeout: 3000 })
  const { indicators } = await savedState()
  check(indicators.volumeMa.visible && indicators.bollinger.visible && indicators.macd.visible, 'los indicadores no se guardaron')
  check(await macdBelowRsi(), 'el MACD no quedó en un panel propio bajo el RSI')
  await toggle(['RSI'])
  check((await rsiLegend.count()) === 0, 'la leyenda del RSI sigue con el RSI apagado')
  check(await macdLegend.isVisible(), 'el MACD desapareció al apagar el RSI')
  await toggle(['RSI'])
  await rsiLegend.waitFor({ timeout: 3000 })
  check(await macdBelowRsi(), 'al volver, el RSI no quedó por encima del MACD')
  await toggle(['Volume moving average', 'Bollinger Bands', 'MACD'])
  check((await macdLegend.count()) === 0, 'la leyenda del MACD sigue con el MACD apagado')
  check((await page.getByText('BB 20 2', { exact: true }).count()) === 0, 'la leyenda de Bollinger sigue apagada')
  await rsiLegend.waitFor({ timeout: 3000 })
})

await step('cambia el color y el grosor de una media', async () => {
  await button('Indicators').click()
  await button('Style of average 1').click()
  await button('Color #F23645 of average 1').click()
  await button('Width 3 of average 1').click()
  await page.keyboard.press('Escape')
  const [sma] = (await savedState()).indicators.sma
  check(sma.color === '#F23645' && sma.width === 3, 'el estilo de la media no se guardó')
})

await step('cambia el tipo de gráfico, la escala y el cursor', async () => {
  await button('Chart').click()
  for (const type of ['Bars', 'Line', 'Area', 'Baseline']) {
    await page.getByRole('radio', { name: type, exact: true }).click()
    await page.waitForTimeout(250)
  }
  await page.getByRole('radio', { name: 'Logarithmic' }).click()
  await page.getByRole('radio', { name: 'Magnet to OHLC' }).click()
  await page.keyboard.press('Escape')
  const saved = (await savedState()).chart
  check(saved.type === 'baseline' && saved.scale === 'log' && saved.cursor === 'magnetOhlc', `ajustes inesperados: ${JSON.stringify(saved)}`)
})

await step('las líneas se pueden dibujar sobre otro tipo de gráfico', async () => {
  const { price } = await panes()
  const before = (await linesOf((await savedState()).symbol)).length
  await drawLine(price, [0.25, 0.6], [0.5, 0.45])
  const state = await savedState()
  check((state.lines[state.symbol] ?? []).length === before + 1, 'la línea no se guardó')
  await page.keyboard.press('Delete')
  check(((await savedState()).lines[state.symbol] ?? []).length === before, 'la línea no se borró')
})

await step('vuelve a velas y escala normal', async () => {
  await button('Chart').click()
  await page.getByRole('radio', { name: 'Candles' }).click()
  await page.getByRole('radio', { name: 'Normal' }).click()
  await page.getByRole('radio', { name: 'Free' }).click()
  await page.keyboard.press('Escape')
  const saved = (await savedState()).chart
  check(saved.type === 'candles' && saved.scale === 'normal' && saved.cursor === 'normal', 'no volvió a los ajustes iniciales')
})

await step('crea una lista nueva', async () => {
  await button('Watchlists').click()
  await button('New watchlist').click()
  await page.getByRole('textbox', { name: 'Name of the new watchlist' }).fill('Prueba')
  await page.keyboard.press('Enter')
  const state = await savedState()
  check(state.watchlists.length === 2, `se esperaban 2 listas y hay ${state.watchlists.length}`)
  check(state.watchlists[1].name === 'Prueba' && state.activeWatchlistId === state.watchlists[1].id, 'la lista nueva no es la activa')
  await page.getByText('This watchlist is empty').waitFor({ timeout: 3000 })
})

await step('añade un símbolo solo a la lista nueva', async () => {
  await button('Add symbol').click()
  await page.getByPlaceholder('Search symbol or company').fill('NFLX')
  await page.getByRole('option').filter({ hasText: 'Netflix' }).first().click()
  await row('NFLX').waitFor({ timeout: 15_000 })
  await page.keyboard.press('Escape')
  const state = await savedState()
  check(symbolsOf(state.watchlists[1].items).map((item) => item.symbol).join(',') === 'NFLX', 'NFLX no está en la lista nueva')
  check(!symbolsOf(state.watchlists[0].items).some((item) => item.symbol === 'NFLX'), 'NFLX se coló en la primera lista')
})

await step('renombra la lista', async () => {
  await button('Watchlists').click()
  await button('Rename Prueba').click()
  await page.getByRole('textbox', { name: 'New name for Prueba' }).fill('Bancos')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Escape')
  check((await savedState()).watchlists[1].name === 'Bancos', 'el nombre no se guardó')
})

await step('pone un icono a la lista desde la paleta o a mano, se ve en la cabecera y sigue tras recargar', async () => {
  const trigger = button('Watchlists')
  const iconOf = async (): Promise<string | undefined> => {
    const state = await savedState()
    return state.watchlists.find((list) => list.id === state.activeWatchlistId)?.icon
  }
  await trigger.click()
  await button('Icon for Bancos').click()
  await page.getByRole('group', { name: 'Icons for Bancos' }).getByRole('button', { name: '🏦', exact: true }).click()
  check((await trigger.textContent())?.startsWith('🏦Bancos') === true, `la cabecera no muestra el icono: ${await trigger.textContent()}`)
  check((await iconOf()) === '🏦', 'el icono no se guardó')
  await page.reload()
  await waitForChart()
  check((await trigger.textContent())?.startsWith('🏦Bancos') === true, 'el icono no siguió tras recargar')
  await trigger.click()
  await button('Icon for Bancos').click()
  await page.getByRole('textbox', { name: 'Any emoji for Bancos' }).fill('🦄')
  await page.keyboard.press('Enter')
  check((await iconOf()) === '🦄', 'el emoji escrito a mano no se guardó')
  await button('Icon for Bancos').click()
  await button('No icon').click()
  await page.keyboard.press('Escape')
  check((await iconOf()) === undefined, 'el icono no se quitó')
  check((await trigger.textContent())?.startsWith('Bancos') === true, 'la cabecera sigue con icono')
})

await step('vuelve a la primera lista', async () => {
  await button('Watchlists').click()
  await page.getByRole('menuitem', { name: 'Watchlist', exact: true }).click()
  await row('AAPL').waitFor({ timeout: 3000 })
  check((await row('NFLX').count()) === 0, 'la primera lista muestra símbolos de la otra')
})

await step('duplica la primera lista y borra la copia', async () => {
  await button('Watchlists').click()
  await button('Duplicate Watchlist').click()
  const copied = await savedState()
  const names = copied.watchlists.map((list) => list.name).join(' | ')
  check(names === 'Watchlist | Watchlist (copy) | Bancos', `listas inesperadas: ${names}`)
  check(copied.activeWatchlistId === copied.watchlists[1].id, 'la copia no es la lista activa')
  check(
    symbolsOf(copied.watchlists[1].items).map((item) => item.symbol).join(',') === symbolsOf(copied.watchlists[0].items).map((item) => item.symbol).join(','),
    'la copia no tiene los mismos símbolos',
  )
  await row('AAPL').waitFor({ timeout: 3000 })
  await button('Watchlists').click()
  await button('Delete Watchlist (copy)').click()
  await button('Confirm deleting Watchlist (copy)').click()
  await page.keyboard.press('Escape')
  check((await savedState()).watchlists.length === 2, 'la copia no se borró')
})

await step('borra la lista tras confirmar', async () => {
  await button('Watchlists').click()
  await button('Delete Bancos').click()
  check((await savedState()).watchlists.length === 2, 'se borró sin confirmar')
  await button('Confirm deleting Bancos').click()
  await page.keyboard.press('Escape')
  const state = await savedState()
  check(state.watchlists.length === 1 && state.watchlists[0].name === 'Watchlist', 'no quedó solo la primera lista')
})

await step('añade, renombra y quita una sección de la lista', async () => {
  const sections = async (): Promise<string[]> => {
    const state = await savedState()
    const list = state.watchlists.find((candidate) => candidate.id === state.activeWatchlistId) ?? state.watchlists[0]
    return list.items.flatMap((item) => ('kind' in item ? [item.title] : []))
  }
  const symbolsBefore = activeItems(await savedState()).length
  await button('Add section').click()
  await page.getByRole('textbox', { name: 'New section name' }).fill('En cartera')
  await page.keyboard.press('Enter')
  await page.getByText('En cartera', { exact: true }).waitFor({ timeout: 3000 })
  check((await sections()).join() === 'En cartera', 'la sección no se guardó')
  await page.getByRole('listitem').filter({ hasText: 'En cartera' }).hover()
  await button('Rename section En cartera').click()
  await page.getByRole('textbox', { name: 'Section name' }).fill('Vigilando')
  await page.keyboard.press('Enter')
  check((await sections()).join() === 'Vigilando', 'la sección no se renombró')
  check(activeItems(await savedState()).length === symbolsBefore, 'la sección cambió los símbolos de la lista')
  await page.getByRole('listitem').filter({ hasText: 'Vigilando' }).hover()
  await button('Remove section Vigilando').click()
  check((await sections()).length === 0, 'la sección no se quitó')
})

await step('la nota de una acción se guarda y vuelve tras recargar', async () => {
  const { symbol } = await savedState()
  const notes = () => page.getByRole('textbox', { name: `Notes for ${symbol}` })
  await button(`Notes for ${symbol}`).click()
  await notes().fill('Comprar por debajo de 60')
  check((await savedState()).notes[symbol] === 'Comprar por debajo de 60', 'la nota no se guardó')
  await page.reload()
  await waitForChart()
  await page.getByRole('img', { name: 'Has a note' }).waitFor({ timeout: 5000 })
  await button(`Notes for ${symbol}`).click()
  check((await notes().inputValue()) === 'Comprar por debajo de 60', 'la nota no volvió tras recargar')
  await notes().fill('')
  check((await savedState()).notes[symbol] === undefined, 'la nota vacía no se borró')
  await button(`Notes for ${symbol}`).click()
})

await step('el borde de la lista cambia su ancho y se conserva al recargar', async () => {
  const separator = page.getByRole('separator', { name: 'Watchlist width' })
  const listWidth = async (): Promise<number> => ((await page.locator('aside').boundingBox()) as Box).width
  const chartWidth = async (): Promise<number> => ((await page.locator('main').boundingBox()) as Box).width
  const pull = async (pixels: number): Promise<void> => {
    const grip = (await separator.boundingBox()) as Box
    const from: [number, number] = [grip.x + grip.width / 2, grip.y + 300]
    await drag(from, [from[0] - pixels, from[1]])
  }
  const before = { list: await listWidth(), chart: await chartWidth() }
  await pull(120)
  const wider = { list: await listWidth(), chart: await chartWidth() }
  check(Math.abs(wider.list - before.list - 120) <= 2, `la lista debía crecer 120 px y creció ${Math.round(wider.list - before.list)}`)
  check(Math.abs(before.chart - wider.chart - 120) <= 2, `el gráfico debía encoger 120 px y encogió ${Math.round(before.chart - wider.chart)}`)
  check((await savedState()).listWidth === Math.round(wider.list), 'el ancho de la lista no se guardó')
  await page.reload()
  await waitForChart()
  check(Math.abs((await listWidth()) - wider.list) <= 1, 'el ancho de la lista no se conservó al recargar')
  const rowsLayout = (): Promise<{ cut: number; prices: number }> =>
    page.evaluate(() => ({
      cut: [...document.querySelectorAll('aside li button > div:first-child > :last-child')].filter(
        (ticker) => ticker.scrollWidth > ticker.clientWidth,
      ).length,
      prices: [...document.querySelectorAll('aside li button > div:nth-child(2)')].filter(
        (price) => getComputedStyle(price).display !== 'none',
      ).length,
    }))
  const rowCount = await page.locator('aside li').count()
  await pull(-1000)
  check((await listWidth()) === 220, `la lista no se detuvo en su ancho mínimo: ${await listWidth()}`)
  const narrow = await rowsLayout()
  check(narrow.cut === 0, `con la lista al mínimo se cortan ${narrow.cut} tickers`)
  check(narrow.prices === 0, 'con la lista al mínimo sigue la columna del último precio')
  check(!(await page.getByText('Last', { exact: true }).isVisible()), 'con la lista al mínimo sigue el rótulo «Último»')
  await pull(1000)
  check((await listWidth()) === 640, `la lista no se detuvo en su ancho máximo: ${await listWidth()}`)
  const wide = await rowsLayout()
  check(wide.cut === 0 && wide.prices === rowCount, 'con la lista ancha faltan precios o se cortan tickers')
  const extendedShown = (): Promise<boolean> => page.getByText('Ext', { exact: true }).isVisible()
  check(await extendedShown(), 'con la lista ancha no se ve la columna de pre y post mercado')
  await pull(380 - 640)
  check((await listWidth()) === 380, `la lista no quedó en 380 px: ${await listWidth()}`)
  const tight = await rowsLayout()
  check(!(await extendedShown()), 'la columna de pre y post mercado sigue con la lista en 380 px')
  check(tight.cut === 0 && tight.prices === rowCount, 'con la lista en 392 px faltan precios o se cortan tickers')
  await pull(1)
  check(await extendedShown(), 'la columna de pre y post mercado no aparece con la lista en 381 px')
  check((await rowsLayout()).cut === 0, 'con las cuatro columnas justas se cortan tickers')
  await pull(259)
  await pull(before.list - 640)
  check((await listWidth()) === before.list, `la lista no volvió a su ancho: ${await listWidth()}`)
  check((await savedState()).listWidth === before.list, 'el ancho restaurado no se guardó')
})

const exportedPath = join(outDir, 'config-exportada.json')

const chooseConfigFile = async (file: string | { name: string; mimeType: string; buffer: Buffer }): Promise<void> => {
  await button('Settings').click()
  await page.getByLabel('Settings file').setInputFiles(file)
}

const jsonFile = (name: string, text: string) => ({ name, mimeType: 'application/json', buffer: Buffer.from(text) })

await step('exporta la configuración a un archivo', async () => {
  await button('Settings').click()
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 5000 }),
    button('Export settings').click(),
  ])
  const name = download.suggestedFilename()
  check(/^doji-config-\d{4}-\d{2}-\d{2}\.json$/.test(name), `nombre de archivo inesperado: ${name}`)
  await download.saveAs(exportedPath)
  await page.keyboard.press('Escape')
  const exported = JSON.parse(await readFile(exportedPath, 'utf8')) as AppState
  const { rev: _rev, ...current } = await savedState()
  check(JSON.stringify(exported) === JSON.stringify(current), 'el archivo no coincide con la configuración guardada')
})

await step('un archivo que no es una configuración no cambia nada', async () => {
  const before = await savedState()
  await chooseConfigFile(jsonFile('nota.json', 'hola'))
  await page.getByRole('alert').getByText('That file is not a doji settings file.').waitFor({ timeout: 3000 })
  check(!(await button('Replace').isVisible()), 'se ofreció importar un archivo inválido')
  await page.keyboard.press('Escape')
  check((await savedState()).rev === before.rev, 'el archivo inválido cambió el estado')
})

await step('importa una configuración solo tras confirmar', async () => {
  const exported = JSON.parse(await readFile(exportedPath, 'utf8')) as AppState
  const other = {
    ...exported,
    theme: exported.theme === 'light' ? 'midnight' : 'light',
    symbol: 'MSFT',
    watchlists: [{ id: 'importada', name: 'Importada', items: [{ symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ' }] }],
    activeWatchlistId: 'importada',
  }
  await chooseConfigFile(jsonFile('otra.json', JSON.stringify(other)))
  await page.getByText(/“otra\.json”/).waitFor({ timeout: 3000 })
  check((await savedState()).watchlists[0].name === 'Watchlist', 'se importó sin confirmar')
  await button('Replace').click()
  await page.getByText('Settings imported.').waitFor({ timeout: 3000 })
  await page.keyboard.press('Escape')
  await button('Watchlists').getByText('Importada').waitFor({ timeout: 3000 })
  await button('MSFT').first().waitFor({ timeout: 3000 })
  const state = await savedState()
  check(state.watchlists.length === 1 && state.watchlists[0].name === 'Importada', 'no se guardó la lista importada')
  check(state.theme === other.theme && state.symbol === 'MSFT', 'no se guardaron el tema y el símbolo importados')
})

await step('importar lo exportado devuelve la configuración anterior', async () => {
  const exported = JSON.parse(await readFile(exportedPath, 'utf8')) as AppState
  await chooseConfigFile(exportedPath)
  await button('Replace').click()
  await page.getByText('Settings imported.').waitFor({ timeout: 3000 })
  await page.keyboard.press('Escape')
  const { rev: _rev, ...current } = await savedState()
  check(JSON.stringify(current) === JSON.stringify(exported), 'la configuración no volvió a ser la exportada')
})

await step('una IA conectada por MCP añade una línea con alerta, una nota y una lista que aparecen sin recargar', async () => {
  const environment = Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
  )
  const client = new Client({ name: 'smoke', version: '1' })
  await client.connect(
    new StdioClientTransport({
      command: resolve('node_modules/.bin/tsx'),
      args: [resolve('mcp/index.ts')],
      env: { ...environment, DOJI_URL: url },
      stderr: 'pipe',
    }),
  )
  const call = async (name: string, args: Record<string, unknown>) => {
    const result = await client.callTool({ name, arguments: args })
    const [first] = result.content as { text: string }[]
    check(result.isError !== true, `${name} falló: ${first.text}`)
    return JSON.parse(first.text)
  }
  const { symbol } = await savedState()
  const noteMark = page.getByRole('img', { name: 'Has a note' })
  check((await noteMark.count()) === 0, `${symbol} ya tenía una nota antes de la prueba`)
  const scan = await call('scan_watchlist', {})
  check(Array.isArray(scan.rows) && scan.rows.length > 0, 'scan_watchlist no devolvió filas')
  const chart = await call('get_chart', { symbol, bars: 5 })
  check(typeof chart.price.close === 'number' && chart.recentBars.rows.length === 5, 'get_chart no devolvió el precio y las velas')
  check(Array.isArray(chart.earnings?.past), 'get_chart no trae las fechas de resultados')
  const level = Number((chart.price.close * 0.97).toFixed(2))
  const { price: seedArea } = await panes()
  const existing = (await drawingsOf(symbol)).map((drawing) => drawing.id)
  await pickTool('Horizontal line')
  await page.mouse.click(seedArea.x + seedArea.width * 0.4, seedArea.y + seedArea.height * 0.2)
  await page.waitForTimeout(600)
  const seeded = (await drawingsOf(symbol)).find((drawing) => !existing.includes(drawing.id))
  check(seeded?.kind === 'hline', 'la línea propia no se guardó antes de que escribiera la IA')
  const added = await call('add_horizontal_line', { symbol, price: level, alert: true, color: '#FF00FF' })
  const [first, second] = chart.recentBars.rows as [string, number, number, number, number, number][]
  const trend = await call('add_trend_line', {
    symbol,
    from: { date: first[0], price: first[4] },
    to: { date: second[0], price: second[4] },
    extend_right: true,
  })
  await call('update_drawing', { symbol, drawing_id: trend.id, color: '#00FFFF', line_style: 'dashed', text: 'IA' })
  const drawnByAi = (await drawingsOf(symbol)).find((drawing) => drawing.id === trend.id)
  check(drawnByAi?.color === '#00FFFF' && drawnByAi.lineStyle === 'dashed' && drawnByAi.by === 'ai', `la IA no cambió su línea: ${JSON.stringify(drawnByAi)}`)
  await call('delete_drawing', { symbol, drawing_id: trend.id })
  check(!(await drawingsOf(symbol)).some((drawing) => drawing.id === trend.id), 'la IA no borró su línea')
  const refused = await client.callTool({ name: 'delete_drawing', arguments: { symbol, drawing_id: seeded?.id ?? '' } })
  check(refused.isError === true, 'la IA pudo borrar una línea del usuario')
  check((await drawingsOf(symbol)).some((drawing) => drawing.id === seeded?.id), 'la línea del usuario desapareció')
  await call('write_note', { symbol, text: 'Nota escrita por la IA' })
  const listsBefore = (await savedState()).watchlists.length
  const created = await call('create_watchlist', { name: 'Lista de la IA', symbols: ['KO', 'PEP', 'ZZZZ'] })
  check(created.added.join() === 'KO,PEP' && created.notFound.join() === 'ZZZZ', `create_watchlist respondió ${JSON.stringify(created)}`)
  await call('add_section', { watchlist: 'Lista de la IA', title: 'Bebidas' })
  await call('add_to_watchlist', { watchlist: 'Lista de la IA', symbols: ['MNST'], section: 'Bebidas' })
  await call('remove_from_watchlist', { watchlist: 'Lista de la IA', symbols: ['PEP'] })
  await call('rename_watchlist', { watchlist: 'Lista de la IA', name: 'Refrescos' })
  const withList = await savedState()
  const made = withList.watchlists.find((list) => list.name === 'Refrescos')
  check(withList.watchlists.length === listsBefore + 1, 'la IA no creó exactamente una lista')
  check(
    JSON.stringify(made?.items.map((item) => ('kind' in item ? `[${item.title}]` : item.symbol))) === '["KO","[Bebidas]","MNST"]',
    `la lista de la IA quedó mal: ${JSON.stringify(made?.items)}`,
  )
  check(withList.activeWatchlistId !== made?.id, 'crear la lista cambió la que había en pantalla')
  await page.waitForTimeout(6000)
  await button('Watchlists').click()
  await page.getByRole('button', { name: 'Rename Refrescos', exact: true }).waitFor({ timeout: 5000 })
  await page.keyboard.press('Escape')
  await noteMark.waitFor({ timeout: 8000 })
  const { price } = await panes()
  await page.mouse.move(700, 10)
  await page.waitForTimeout(300)
  check(await hasColor(price, [255, 0, 255]), 'la línea de la IA no se ve en el gráfico')
  await page.keyboard.press('Control+z')
  await page.waitForTimeout(400)
  const afterUndo = await drawingsOf(symbol)
  const kept = afterUndo.find((drawing) => drawing.id === added.id)
  check(kept?.kind === 'hline' && kept.alert === true && kept.value === level, 'deshacer quitó o cambió la línea de la IA')
  check(afterUndo.some((drawing) => drawing.id === seeded?.id), 'deshacer quitó la línea propia: el historial no se olvidó al llegar lo de la IA')
  const themeBefore = (await savedState()).theme
  await flipTheme(themeBefore)
  const afterToggle = await savedState()
  check(afterToggle.theme !== themeBefore, 'el cambio de tema de la pestaña chocó con lo que guardó la IA')
  check((afterToggle.lines[symbol] ?? []).some((drawing) => drawing.id === added.id), 'la línea de la IA se perdió')
  check((await page.getByText(/changed in another tab/).count()) === 0, 'la pestaña se recargó por un conflicto')
  await flipTheme(afterToggle.theme)
  const latest = await savedState()
  const cleaned = await fetch(`${url}/api/state`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...latest,
      lines: {
        ...latest.lines,
        [symbol]: (latest.lines[symbol] ?? []).filter((drawing) => drawing.id !== added.id && drawing.id !== seeded?.id),
      },
      notes: Object.fromEntries(Object.entries(latest.notes).filter(([key]) => key !== symbol)),
      watchlists: latest.watchlists.filter((list) => list.name !== 'Refrescos'),
    }),
  })
  check(cleaned.ok, 'no se pudo limpiar lo que añadió la IA')
  await noteMark.waitFor({ state: 'detached', timeout: 8000 })
  await client.close()
})

await step('la API rechaza las peticiones hechas desde otras webs', async () => {
  const foreign = await context.request.get(`${url}/api/history?symbol=ZZZZ`, { headers: { 'sec-fetch-site': 'cross-site' } })
  check(foreign.status() === 403, `se esperaba 403 y llegó ${foreign.status()}`)
  const own = await context.request.get(`${url}/api/state`, { headers: { 'sec-fetch-site': 'same-origin' } })
  check(own.status() === 200, `la app se quedó sin acceso: ${own.status()}`)
})

await step('el canal de precios en vivo responde y rechaza las peticiones de otras webs', async () => {
  const abort = new AbortController()
  const response = await fetch(`${url}/api/stream?symbols=AAPL`, { signal: abort.signal })
  check(response.status === 200, `el canal respondió ${response.status}`)
  check(response.headers.get('content-type') === 'text/event-stream; charset=utf-8', 'el canal no es un flujo de eventos')
  const first = await response.body?.getReader().read()
  check(new TextDecoder().decode(first?.value).startsWith('retry: 3000'), 'el canal no dice al navegador cuándo reconectar')
  abort.abort()
  const foreign = await fetch(`${url}/api/stream?symbols=AAPL`, { headers: { 'sec-fetch-site': 'cross-site' } })
  check(foreign.status === 403, `se esperaba 403 para otra web y llegó ${foreign.status}`)
  const empty = await fetch(`${url}/api/stream?symbols=`)
  check(empty.status === 400, `se esperaba 400 sin símbolos y llegó ${empty.status}`)
  check((await fetch(`${url}/api/state`)).ok, 'el servidor dejó de responder tras cerrar el canal')
})

await step('al cerrar con un estado grande se guarda el último cambio', async () => {
  const state = await savedState()
  const template: TrendLine = {
    id: 'carga',
    pane: 'price',
    timeframe: 'D',
    p1: { date: '2026-01-05', value: 100 },
    p2: { date: '2026-02-05', value: 110 },
    color: '#2962FF',
    width: 2,
    extendRight: false,
    pricedAt: '9999-12-31',
  }
  const many = Array.from({ length: 400 }, (_, index) => ({ ...template, id: `carga-${index}` }))
  const send = (body: AppState) =>
    fetch(`${url}/api/state`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  check((await send({ ...state, lines: { ...state.lines, CARGA: many } })).ok, 'no se pudo cargar el estado grande')
  await page.reload()
  await waitForChart()
  const before = await savedState()
  check(new TextEncoder().encode(JSON.stringify(before)).length > 65_536, 'el estado de prueba no supera el límite del navegador')
  await flipTheme(before.theme)
  await page.goto('about:blank')
  let after = await savedState()
  for (let attempt = 0; attempt < 25 && after.theme === before.theme; attempt += 1) {
    await new Promise((done) => setTimeout(done, 200))
    after = await savedState()
  }
  check(after.theme !== before.theme, 'el último cambio se perdió al cerrar')
  check((after.lines.CARGA ?? []).length === 400, 'se perdieron líneas al guardar solo los cambios')
  const { CARGA: _load, ...lines } = after.lines
  check((await send({ ...after, lines })).ok, 'no se pudo retirar el estado grande')
  await page.goto(url)
  await waitForChart()
})

await step('una pestaña atrasada no pisa lo que guardó otra', async () => {
  const other = await context.newPage()
  await other.goto(url)
  await other.waitForSelector('canvas', { timeout: 20_000 })
  await other.getByRole('button', { name: 'W', exact: true }).click()
  await other.waitForTimeout(900)
  await other.close()
  const afterOther = await savedState()
  check(afterOther.timeframe === 'W', 'la segunda pestaña no guardó')
  await flipTheme(afterOther.theme)
  await page.getByText('The settings changed in another tab and were reloaded').waitFor({ timeout: 5000 })
  const final = await savedState()
  check(final.timeframe === 'W', 'la pestaña atrasada pisó el cambio de la otra')
  check(final.theme === afterOther.theme, 'la pestaña atrasada guardó su cambio sobre un estado viejo')
  await page.getByText(/ · 1W · /).waitFor({ timeout: 5000 })
})

await step('el tema doji pinta velas y rellenos con sus colores y se recuerda al recargar', async () => {
  await chooseTheme('Doji')
  await page.reload()
  await waitForChart()
  check((await savedState()).theme === 'doji', 'el tema doji no se guardó')
  const { price } = await panes()
  await page.mouse.move(700, 10)
  check(near(await chartPixel(price), [21, 20, 18]), `el gráfico no recuperó el fondo de doji: ${await chartPixel(price)}`)
  check(await hasColor(price, [60, 198, 138]), 'no hay velas alcistas con el verde de doji')
  check(await hasColor(price, [242, 92, 105], EXACT_TOLERANCE), 'no hay velas bajistas con el rojo de doji')
  await button('Chart').click()
  await page.getByRole('radio', { name: 'Area', exact: true }).click()
  await page.keyboard.press('Escape')
  await page.mouse.move(700, 10)
  await page.waitForTimeout(500)
  check(await hasColor(price, [124, 92, 255]), 'la línea del gráfico de área no usa el violeta de doji')
  await button('Chart').click()
  await page.getByRole('radio', { name: 'Candles', exact: true }).click()
  await page.keyboard.press('Escape')
  check((await savedState()).chart.type === 'candles', 'no volvió a velas')
})

await step('una petición mal formada no tumba el servidor', async () => {
  const bad = await fetch(`${url}//`)
  check(bad.status === 400, `se esperaba 400 y llegó ${bad.status}`)
  const ok = await fetch(`${url}/api/state`)
  check(ok.status === 200, 'el servidor dejó de responder')
})

await browser.close()
fakeTelegram.close()

if (pageErrors.length > 0) {
  console.error(`errores en la consola del navegador:\n${pageErrors.join('\n')}`)
  process.exit(1)
}

console.log(`todo correcto: ${stepNumber} pasos, capturas en ${outDir}`)
