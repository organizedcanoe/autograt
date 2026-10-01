/** Makes the browser save a blob as a file with the given name. */
export function saveFile(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  // Revoked later, as some browsers read the URL only after click() returns.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
