import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowUpRight,
  Download,
  FileText,
  Link2,
  MessageSquare,
  Trash2,
} from 'lucide-react'
import { RiskBadge } from '@/components/ui/Badge'
import { SkeletonRows } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { apiErrorMessage } from '@/services/api'
import { reportService } from '@/services/reportService'
import { cn } from '@/lib/cn'
import { relativeTime, truncate } from '@/lib/format'
import { riskTheme } from '@/lib/risk'
import type { ScanListItem, ScanType } from '@/types'

const TYPE_ICON: Record<ScanType, typeof Link2> = {
  URL: Link2,
  MESSAGE: MessageSquare,
  DOCUMENT: FileText,
}

const TYPE_ACCENT: Record<ScanType, string> = {
  URL: 'border-cyan-400/25 bg-cyan-400/10 text-cyan-300',
  MESSAGE: 'border-indigo-400/25 bg-indigo-400/10 text-indigo-300',
  DOCUMENT: 'border-pink-400/25 bg-pink-400/10 text-pink-300',
}

export function ScanTypeIcon({ type, className }: { type: ScanType; className?: string }) {
  const Icon = TYPE_ICON[type] ?? Link2
  return (
    <span
      className={cn(
        'grid h-9 w-9 shrink-0 place-items-center rounded-xl border',
        TYPE_ACCENT[type],
        className,
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </span>
  )
}

/**
 * Responsive scan list — a real table on desktop, stacked cards on mobile.
 * Used by the dashboard (recent scans), history page and admin dashboard.
 */
export function ScanHistoryTable({
  items,
  loading = false,
  emptyTitle = 'No scans yet',
  emptyDescription = 'Analyse a URL, message or document and it will appear here.',
  emptyAction,
  showUser = false,
  onDelete,
  deletingId,
  compact = false,
}: {
  items: ScanListItem[]
  loading?: boolean
  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: ReactNode
  showUser?: boolean
  onDelete?: (scan: ScanListItem) => void
  deletingId?: number | null
  compact?: boolean
}) {
  const toast = useToast()
  const [downloadingId, setDownloadingId] = useState<number | null>(null)

  async function handleDownload(scanId: number) {
    setDownloadingId(scanId)
    try {
      const filename = await reportService.download(scanId, 'pdf')
      toast.success(`Report downloaded — ${filename}`)
    } catch (caught) {
      toast.error(apiErrorMessage(caught, 'The report could not be downloaded.'))
    } finally {
      setDownloadingId(null)
    }
  }

  if (loading) return <SkeletonRows rows={compact ? 4 : 6} />

  if (!items.length) {
    return (
      <EmptyState
        icon={<Link2 className="h-6 w-6" aria-hidden />}
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    )
  }

  return (
    <>
      {/* Desktop */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-hairline/70 text-[10px] uppercase tracking-[0.16em] text-ink-faint">
              <th className="px-5 py-3 font-semibold">Target</th>
              <th className="px-3 py-3 font-semibold">Verdict</th>
              <th className="px-3 py-3 font-semibold">Risk</th>
              <th className="px-3 py-3 font-semibold">Signals</th>
              <th className="px-3 py-3 font-semibold">When</th>
              <th className="px-5 py-3 text-right font-semibold">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline/50">
            {items.map((scan) => {
              const theme = riskTheme(scan.risk_level)
              return (
                <tr key={scan.scan_id} className="group transition-colors hover:bg-white/[0.02]">
                  <td className="max-w-[22rem] px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <ScanTypeIcon type={scan.scan_type} />
                      <div className="min-w-0">
                        <Link
                          to={`/dashboard/scans/${scan.scan_id}`}
                          className="block truncate font-medium text-ink transition-colors hover:text-cyan-300"
                          title={scan.target_label}
                        >
                          {truncate(scan.target_label, 58)}
                        </Link>
                        <p className="mt-0.5 text-[11px] uppercase tracking-wider text-ink-faint">
                          {scan.scan_type} · #{scan.scan_id}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3.5">
                    <span className={cn('text-[13px] font-medium', theme.text)}>
                      {scan.prediction}
                    </span>
                  </td>
                  <td className="px-3 py-3.5">
                    <RiskBadge level={scan.risk_level} score={scan.risk_score} />
                  </td>
                  <td className="px-3 py-3.5 text-[13px] tabular-nums text-ink-muted">
                    {scan.indicator_count}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3.5 text-[13px] text-ink-muted">
                    {relativeTime(scan.created_at)}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        to={`/dashboard/scans/${scan.scan_id}`}
                        className="rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-white/5 hover:text-cyan-300"
                        aria-label={`Open scan ${scan.scan_id}`}
                      >
                        <ArrowUpRight className="h-4 w-4" aria-hidden />
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDownload(scan.scan_id)}
                        disabled={downloadingId === scan.scan_id}
                        className="rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-cyan-500/10 hover:text-cyan-300 disabled:opacity-40"
                        aria-label={`Download report for scan ${scan.scan_id}`}
                        title="Download PDF report"
                      >
                        <Download className={cn('h-4 w-4', downloadingId === scan.scan_id && 'animate-pulse')} aria-hidden />
                      </button>
                      {onDelete && (
                        <button
                          type="button"
                          onClick={() => onDelete(scan)}
                          disabled={deletingId === scan.scan_id}
                          className="rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-red-500/10 hover:text-red-300 disabled:opacity-40"
                          aria-label={`Delete scan ${scan.scan_id}`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {showUser && (
          <p className="px-5 py-3 text-[11px] text-ink-faint">
            Open a scan to see which account submitted it.
          </p>
        )}
      </div>

      {/* Mobile */}
      <ul className="divide-y divide-hairline/50 md:hidden">
        {items.map((scan) => {
          const theme = riskTheme(scan.risk_level)
          return (
            <li key={scan.scan_id} className="px-4 py-3.5">
              <div className="flex items-start gap-3">
                <ScanTypeIcon type={scan.scan_type} />
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/dashboard/scans/${scan.scan_id}`}
                    className="block break-words text-[13px] font-medium text-ink"
                  >
                    {truncate(scan.target_label, 70)}
                  </Link>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <RiskBadge level={scan.risk_level} score={scan.risk_score} />
                    <span className={cn('text-[11px] font-medium', theme.text)}>
                      {scan.prediction}
                    </span>
                    <span className="text-[11px] text-ink-faint">
                      {relativeTime(scan.created_at)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleDownload(scan.scan_id)}
                    disabled={downloadingId === scan.scan_id}
                    className="rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-cyan-500/10 hover:text-cyan-300 disabled:opacity-40"
                    aria-label={`Download report for scan ${scan.scan_id}`}
                    title="Download PDF report"
                  >
                    <Download className={cn('h-4 w-4', downloadingId === scan.scan_id && 'animate-pulse')} aria-hidden />
                  </button>
                  {onDelete && (
                    <button
                      type="button"
                      onClick={() => onDelete(scan)}
                      disabled={deletingId === scan.scan_id}
                      className="rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-red-500/10 hover:text-red-300 disabled:opacity-40"
                      aria-label={`Delete scan ${scan.scan_id}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}
