import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { PaginatedMeta } from '@/types'

/** Compact page range with ellipses, e.g. 1 … 4 5 6 … 12 */
function pageWindow(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)
  const pages = new Set<number>([1, total, current, current - 1, current + 1])
  const sorted = [...pages].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b)

  const result: (number | '…')[] = []
  sorted.forEach((page, index) => {
    if (index > 0 && page - (sorted[index - 1] as number) > 1) result.push('…')
    result.push(page)
  })
  return result
}

export function Pagination({
  meta,
  onChange,
  className,
}: {
  meta: PaginatedMeta
  onChange: (page: number) => void
  className?: string
}) {
  const totalPages = Math.max(1, meta.total_pages)
  if (meta.total === 0) return null

  const from = (meta.page - 1) * meta.page_size + 1
  const to = Math.min(meta.total, meta.page * meta.page_size)

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 border-t border-hairline/70 px-5 py-3',
        className,
      )}
    >
      <p className="text-[11px] text-ink-faint">
        Showing <span className="tabular-nums text-ink-muted">{from}</span>–
        <span className="tabular-nums text-ink-muted">{to}</span> of{' '}
        <span className="tabular-nums text-ink-muted">{meta.total}</span> scans
      </p>

      {totalPages > 1 && (
        <nav className="flex items-center gap-1" aria-label="Pagination">
          <button
            type="button"
            onClick={() => onChange(meta.page - 1)}
            disabled={meta.page <= 1}
            className="grid h-8 w-8 place-items-center rounded-lg border border-hairline text-ink-muted transition-colors hover:border-cyan-400/40 hover:text-ink disabled:pointer-events-none disabled:opacity-35"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>

          {pageWindow(meta.page, totalPages).map((entry, index) =>
            entry === '…' ? (
              <span key={`gap-${index}`} className="px-1 text-xs text-ink-faint">
                …
              </span>
            ) : (
              <button
                key={entry}
                type="button"
                onClick={() => onChange(entry)}
                aria-current={entry === meta.page ? 'page' : undefined}
                className={cn(
                  'h-8 min-w-8 rounded-lg border px-2 text-xs font-medium tabular-nums transition-colors',
                  entry === meta.page
                    ? 'border-cyan-400/50 bg-cyan-400/12 text-cyan-200'
                    : 'border-hairline text-ink-muted hover:border-cyan-400/30 hover:text-ink',
                )}
              >
                {entry}
              </button>
            ),
          )}

          <button
            type="button"
            onClick={() => onChange(meta.page + 1)}
            disabled={meta.page >= totalPages}
            className="grid h-8 w-8 place-items-center rounded-lg border border-hairline text-ink-muted transition-colors hover:border-cyan-400/40 hover:text-ink disabled:pointer-events-none disabled:opacity-35"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </nav>
      )}
    </div>
  )
}
