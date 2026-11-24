import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'
import { LOGO_SVG } from './mark'

const root = resolve(import.meta.dirname, '../../..')

test('Should use the doji mark as the icon of the browser tab', () => {
  expect(readFileSync(resolve(root, 'public/favicon.svg'), 'utf8').trim()).toBe(LOGO_SVG)
  expect(readFileSync(resolve(root, 'index.html'), 'utf8')).toContain('<link rel="icon" type="image/svg+xml" href="/favicon.svg" />')
})
