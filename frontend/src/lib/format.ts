/** Small display helpers shared across pages. */

export function formatDateTime(value: string | Date | undefined): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDate(value: string | Date | undefined): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatShortDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
}

export function relativeTime(value: string | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  const seconds = Math.round((Date.now() - date.getTime()) / 1000)
  if (seconds < 45) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  return formatDate(date)
}

export function formatBytes(bytes: number | undefined): string {
  if (!bytes && bytes !== 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function formatNumber(value: number | undefined): string {
  if (value === undefined || value === null) return '—'
  return value.toLocaleString()
}

export function truncate(text: string, limit = 90): string {
  const clean = (text ?? '').trim()
  return clean.length <= limit ? clean : `${clean.slice(0, limit - 1)}…`
}

/** Turn SNAKE_CASE codes into readable words. */
export function humanise(code: string): string {
  return code
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/^\w/, (character) => character.toUpperCase())
}

export function initials(name: string): string {
  return (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}
