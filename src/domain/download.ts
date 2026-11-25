export const downloadBlob = (blob: Blob, name: string): void => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

export const downloadText = (text: string, name: string, type = 'application/json'): void =>
  downloadBlob(new Blob([text], { type }), name)
