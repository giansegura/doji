import { mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright-core'
import type { AppState, TrendLine } from '../shared/types'

type Box = { x: number; y: number; width: number; height: number }

const [url, outDir] = process.argv.slice(2)

if (!url || !outDir) {
  console.error('Uso: npm run smoke -- <url> <carpetaSalida>')
  process.exit(1)
}

await mkdir(outDir, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()
const pageErrors: string[] = []
let stepNumber = 0

page.on('pageerror', (error) => pageErrors.push(`[paso ${stepNumber}] ${error.message}`))
page.on('console', (message) => {
  const expectedConflict = message.text().includes('409 (Conflict)') && message.location().url.endsWith('/api/state')
  if (message.type() === 'error' && !expectedConflict) {
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
    process.exit(1)
  }
}

const savedState = async (): Promise<AppState> => {
  await page.waitForTimeout(800)
  return (await fetch(`${url}/api/state`)).json() as Promise<AppState>
}

const activeItems = (state: AppState) =>
  (state.watchlists.find((list) => list.id === state.activeWatchlistId) ?? state.watchlists[0]).items

const linesOf = async (symbol: string): Promise<TrendLine[]> => (await savedState()).lines[symbol] ?? []

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

const row = (symbol: string) => page.getByRole('listitem').getByRole('button', { name: new RegExp(`^${symbol}\\b`) })

const drawLine = async (box: Box, from: [number, number], to: [number, number]): Promise<void> => {
  await button('Trend line').click()
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
  await button('Width 4').click()
  await button('Extend right').click()
  const [line] = await linesOf('AAPL')
  check(line.color === '#F23645' && line.width === 4 && line.extendRight, 'el estilo no se guardó')
})

await step('borra la línea del precio con Supr', async () => {
  await page.keyboard.press('Delete')
  const lines = await linesOf('AAPL')
  check(lines.length === 1 && lines[0].pane === 'rsi', 'no quedó solo la línea del RSI')
})

await step('cancela una línea a medias con Esc', async () => {
  const { price } = await panes()
  await button('Trend line').click()
  await page.mouse.click(...at(price, 0.2, 0.6))
  await page.mouse.move(...at(price, 0.4, 0.4), { steps: 4 })
  await page.keyboard.press('Escape')
  check((await linesOf('AAPL')).length === 1, 'Esc no canceló la línea')
  check((await button('Cursor').getAttribute('aria-pressed')) === 'true', 'Esc no devolvió el cursor')
})

await step('Esc con la herramienta armada vuelve al cursor', async () => {
  await button('Trend line').click()
  check((await button('Trend line').getAttribute('aria-pressed')) === 'true', 'la herramienta no se armó')
  await page.keyboard.press('Escape')
  check((await button('Cursor').getAttribute('aria-pressed')) === 'true', 'Esc no devolvió el cursor')
})

await step('un clic que empieza fuera del gráfico no termina la línea', async () => {
  const { price } = await panes()
  await button('Trend line').click()
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
    await button('Trend line').click()
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
  await button('Trend line').click()
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


await step('la vista no salta al cambiar de tema y volver', async () => {
  const before = await timeAxisPixels()
  await button(/Switch to light theme/).click()
  await page.waitForTimeout(400)
  await button(/Switch to dark theme/).click()
  const after = await timeAxisPixels()
  check(before === after, 'la vista volvió a la última vela')
})

await step('la vista no salta al quitar y poner el volumen', async () => {
  const before = await timeAxisPixels()
  await button('Indicators').click()
  await page.getByRole('checkbox', { name: 'Volume' }).click()
  await page.waitForTimeout(400)
  await page.getByRole('checkbox', { name: 'Volume' }).click()
  await page.keyboard.press('Escape')
  const after = await timeAxisPixels()
  check(before === after, 'la vista volvió a la última vela')
})

await step('cambia de tema', async () => {
  const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  const dark = await background()
  await button(/Switch to light theme/).click()
  await page.waitForTimeout(300)
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
  await page.unroute(fresh)
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
  check(state.lines.MSFT === undefined, 'MSFT tiene líneas que no se dibujaron')
})

await step('añade KO desde el buscador', async () => {
  await button('Add symbol').click()
  await page.getByPlaceholder('Search symbol or company').fill('KO')
  await page.getByRole('option').filter({ hasText: 'Coca-Cola' }).first().click()
  await page.getByText(/Coca-Cola.* · 1D/).waitFor({ timeout: 15_000 })
  const state = await savedState()
  check(activeItems(state).some((item) => item.symbol === 'KO'), 'KO no se añadió a la lista')
  await row('KO').waitFor({ timeout: 3000 })
})

await step('quita KO de la lista', async () => {
  await row('KO').hover()
  await button('Remove KO').click()
  check(!activeItems(await savedState()).some((item) => item.symbol === 'KO'), 'KO sigue en la lista')
})

await step('Enter antes de que lleguen los resultados elige el primero', async () => {
  const before = activeItems(await savedState()).map((item) => item.symbol)
  await button('Add symbol').click()
  await page.getByPlaceholder('Search symbol or company').pressSequentially('KO')
  await page.keyboard.press('Enter')
  await page.getByRole('dialog', { name: 'Symbol search' }).waitFor({ state: 'detached', timeout: 10_000 })
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

await step('muestra logos de empresa y no la columna de cambio absoluto', async () => {
  await page.locator('li img[data-loaded="true"]').first().waitFor({ timeout: 30_000 })
  check((await page.getByText('Cambio', { exact: true }).count()) === 0, 'la columna Cambio sigue visible')
  check((await page.getByText('Change %', { exact: true }).count()) === 1, 'falta la columna Cambio %')
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
  const state = await savedState()
  check(state.watchlists[1].items.map((item) => item.symbol).join(',') === 'NFLX', 'NFLX no está en la lista nueva')
  check(!state.watchlists[0].items.some((item) => item.symbol === 'NFLX'), 'NFLX se coló en la primera lista')
})

await step('renombra la lista', async () => {
  await button('Watchlists').click()
  await button('Rename Prueba').click()
  await page.getByRole('textbox', { name: 'New name for Prueba' }).fill('Bancos')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Escape')
  check((await savedState()).watchlists[1].name === 'Bancos', 'el nombre no se guardó')
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
    copied.watchlists[1].items.map((item) => item.symbol).join(',') === copied.watchlists[0].items.map((item) => item.symbol).join(','),
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
    theme: exported.theme === 'dark' ? 'light' : 'dark',
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

await step('la API rechaza las peticiones hechas desde otras webs', async () => {
  const foreign = await context.request.get(`${url}/api/history?symbol=ZZZZ`, { headers: { 'sec-fetch-site': 'cross-site' } })
  check(foreign.status() === 403, `se esperaba 403 y llegó ${foreign.status()}`)
  const own = await context.request.get(`${url}/api/state`, { headers: { 'sec-fetch-site': 'same-origin' } })
  check(own.status() === 200, `la app se quedó sin acceso: ${own.status()}`)
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
  await button(/Switch to .* theme/).click()
  await page.goto('about:blank')
  const after = await savedState()
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
  await button(/Switch to .* theme/).click()
  await page.getByText('The settings changed in another tab and were reloaded').waitFor({ timeout: 5000 })
  const final = await savedState()
  check(final.timeframe === 'W', 'la pestaña atrasada pisó el cambio de la otra')
  check(final.theme === afterOther.theme, 'la pestaña atrasada guardó su cambio sobre un estado viejo')
  await page.getByText(/ · 1W · /).waitFor({ timeout: 5000 })
})

await step('una petición mal formada no tumba el servidor', async () => {
  const bad = await fetch(`${url}//`)
  check(bad.status === 400, `se esperaba 400 y llegó ${bad.status}`)
  const ok = await fetch(`${url}/api/state`)
  check(ok.status === 200, 'el servidor dejó de responder')
})

await browser.close()

if (pageErrors.length > 0) {
  console.error(`errores en la consola del navegador:\n${pageErrors.join('\n')}`)
  process.exit(1)
}

console.log(`todo correcto: ${stepNumber} pasos, capturas en ${outDir}`)
