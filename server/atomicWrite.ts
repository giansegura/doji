import { open, rename } from 'node:fs/promises'

export const writeAtomic = async (file: string, text: string, mode?: number): Promise<void> => {
  const temporary = `${file}.tmp`
  const handle = await open(temporary, 'w', mode)
  try {
    await handle.writeFile(text)
    await handle.sync()
  } finally {
    await handle.close()
  }
  await rename(temporary, file)
}
