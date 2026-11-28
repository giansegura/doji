import { open, rename, rm } from 'node:fs/promises'

export const writeAtomic = async (file: string, text: string, mode?: number): Promise<void> => {
  const temporary = `${file}.tmp`
  // The mode only counts for a file this call creates, so one left behind goes first: others may be able to read it.
  if (mode !== undefined) await rm(temporary, { force: true })
  const handle = await open(temporary, mode === undefined ? 'w' : 'wx', mode)
  try {
    await handle.writeFile(text)
    await handle.sync()
  } finally {
    await handle.close()
  }
  await rename(temporary, file)
}
