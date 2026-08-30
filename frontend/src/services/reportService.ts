import { api } from './api'

/** Parse `filename="..."` out of a Content-Disposition header. */
function filenameFromHeader(header: unknown, fallback: string): string {
  if (typeof header !== 'string') return fallback
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header)
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1])
    } catch {
      /* fall through to the plain filename */
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header)
  return plain?.[1] ?? fallback
}

export const reportService = {
  /**
   * Download a scan report and trigger a real browser download.
   * The backend serves PDF when fpdf2 is available and falls back to
   * printable HTML otherwise, so this always produces a file.
   */
  async download(scanId: number, format: 'pdf' | 'html' = 'pdf'): Promise<string> {
    const response = await api.get(`/reports/${scanId}`, {
      params: { fmt: format },
      responseType: 'blob',
    })

    const fallback = `fraudshield-report-${scanId}.${format}`
    const filename = filenameFromHeader(response.headers['content-disposition'], fallback)
    const blob = new Blob([response.data as BlobPart], {
      type: (response.headers['content-type'] as string) || 'application/octet-stream',
    })

    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.rel = 'noopener'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    // Revoke on the next tick so Safari has time to start the download.
    window.setTimeout(() => URL.revokeObjectURL(url), 4000)

    return filename
  },
}
