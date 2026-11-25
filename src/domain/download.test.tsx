import { afterEach, expect, test, vi } from 'vitest'
import { downloadBlob, downloadText } from './download'

const capture = () => {
  const steps: string[] = []
  const blobs: Blob[] = []
  vi.stubGlobal(
    'URL',
    Object.assign(URL, {
      createObjectURL: (blob: Blob) => {
        blobs.push(blob)
        steps.push('create')
        return `blob:doji/${blobs.length}`
      },
      revokeObjectURL: (url: string) => {
        steps.push(`revoke ${url}`)
      },
    }),
  )
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
    steps.push('click')
  })
  const links = () =>
    (click.mock.contexts as HTMLAnchorElement[]).map((link) => ({ name: link.download, href: link.href }))
  return { steps, blobs, links }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

test('Should hand the browser a file with the given name', () => {
  const { blobs, links } = capture()
  const blob = new Blob(['hola'])
  downloadBlob(blob, 'nota.txt')
  expect(blobs).toEqual([blob])
  expect(links()).toEqual([{ name: 'nota.txt', href: 'blob:doji/1' }])
})

test('Should release the file only after the browser has it', () => {
  const { steps } = capture()
  downloadBlob(new Blob(['hola']), 'nota.txt')
  expect(steps).toEqual(['create', 'click', 'revoke blob:doji/1'])
})

test('Should save text as a JSON file', async () => {
  const { blobs, links } = capture()
  downloadText('{"a":1}', 'datos.json')
  expect(links().map((link) => link.name)).toEqual(['datos.json'])
  expect(blobs[0].type).toBe('application/json')
  expect(await blobs[0].text()).toBe('{"a":1}')
})

test('Should save other text with the type it is given', async () => {
  const { blobs } = capture()
  downloadText('Symbol\nAAPL\n', 'lista.csv', 'text/csv')
  expect(blobs[0].type).toBe('text/csv')
})
