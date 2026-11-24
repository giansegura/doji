import { chromium } from 'playwright-core'

const [url, output, width = '1440', height = '900'] = process.argv.slice(2)

if (!url || !output) {
  console.error('Uso: npm run shot -- <url> <salida.png> [ancho] [alto]')
  process.exit(1)
}

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: Number(width), height: Number(height) } })
await page.goto(url)
await page.waitForSelector('canvas', { timeout: 8000 }).catch(() => undefined)
await page.waitForTimeout(1500)
await page.screenshot({ path: output })
await browser.close()
console.log(`captura guardada en ${output}`)
