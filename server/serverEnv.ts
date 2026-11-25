import { unlink } from 'node:fs/promises'

const isMissing = (error: unknown): boolean => (error as { code?: unknown } | null)?.code === 'ENOENT'

export const testHooksOn = (env: Record<string, string | undefined>): boolean => env.DOJI_TEST_HOOKS === '1'

export const removeFile = async (file: string, remove: (file: string) => Promise<void> = unlink): Promise<void> => {
  try {
    await remove(file)
  } catch (error) {
    if (!isMissing(error)) throw error
  }
}
