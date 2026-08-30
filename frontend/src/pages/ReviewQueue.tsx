import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  Download,
  Filter,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
} from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { RiskBadge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Select'
import { useAsync } from '@/hooks/useAsync'
import { useToast } from '@/components/ui/Toast'
import { apiErrorMessage } from '@/services/api'
import { reportService } from '@/services/reportService'
import { scanService } from '@/services/scanService'
import { formatDateTime, relativeTime } from '@/lib/format'
import type { RiskLevel } from '@/types'

const REVIEW_LEVELS: Array<'ALL' | RiskLevel> = ['ALL', 'HIGH', 'CRITICAL']

export default function ReviewQueue() {
  const toast = useToast()
  const [riskFilter, setRiskFilter] = useState<'ALL' | RiskLevel>('ALL')
  const [downloadingId, setDownloadingId] = useState<number | null>(null)

  const { data, loading, error, reload } = useAsync(async () => {
    const response = await scanService.history({ page: 1, page_size: 100 })
    return response
  }, [])

  const queue = useMemo(() => {
    const items = (data?.items ?? []).filter((scan) =>
      scan.risk_level === 'HIGH' || scan.risk_level === 'CRITICAL',
    )

    return [...items].sort((a, b) => {
      const priority = Number(b.risk_score) - Number(a.risk_score)
      if (priority !== 0) return priority
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }, [data?.items])

  const visibleQueue = useMemo(() => {
    if (riskFilter === 'ALL') return queue
    return queue.filter((scan) => scan.risk_level === riskFilter)
  }, [queue, riskFilter])

  const summary = {
    total: queue.length,
    high: queue.filter((scan) => scan.risk_level === 'HIGH').length,
    critical: queue.filter((scan) => scan.risk_level === 'CRITICAL').length,
  }

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

  function exportCsv() {
    if (!visibleQueue.length) {
      toast.push('There are no scans in the current review queue.', 'info')
      return
    }

    const header = ['scan_id', 'scan_type', 'target_label', 'prediction', 'risk_score', 'risk_level', 'created_at']
    const csv = [
      header.join(','),
      ...visibleQueue.map((scan) =>
        [
          scan.scan_id,
          scan.scan_type,
          scan.target_label,
          scan.prediction,
          scan.risk_score,
          scan.risk_level,
          scan.created_at,
        ]
          .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
          .join(','),
      ),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `fraudshield-review-queue-${riskFilter.toLowerCase()}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${visibleQueue.length} item${visibleQueue.length === 1 ? '' : 's'} for review.`)
  }

  return (
    <div>
      <PageHeader
        eyebrow="Triage"
        title="Review queue"
        description="High-priority scans that need analyst attention, sorted by urgency and recent risk signals."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={reload} disabled={loading}>
              Refresh
            </Button>
            <Button variant="primary" size="sm" onClick={exportCsv} disabled={loading || !visibleQueue.length}>
              Export CSV
            </Button>
          </div>
        }
      />

      {error && (
        <Alert tone="danger" className="mb-5" title="Could not load the review queue">
          {error}
        </Alert>
      )}

      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <Card>
          <CardBody className="flex items-center justify-between gap-3 p-5">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-ink-faint">Queue</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{summary.total}</p>
            </div>
            <AlertTriangle className="h-7 w-7 text-orange-300" aria-hidden />
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex items-center justify-between gap-3 p-5">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-ink-faint">High risk</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{summary.high}</p>
            </div>
            <ShieldAlert className="h-7 w-7 text-amber-300" aria-hidden />
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex items-center justify-between gap-3 p-5">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-ink-faint">Critical</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{summary.critical}</p>
            </div>
            <ShieldX className="h-7 w-7 text-red-300" aria-hidden />
          </CardBody>
        </Card>
      </div>

      <Card className="mb-5">
        <CardHeader
          title="Queue filters"
          subtitle="Focus the review list by urgency"
          icon={<Filter className="h-4 w-4" aria-hidden />}
        />
        <CardBody className="pt-5">
          <div className="max-w-xs">
            <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
              Risk band
            </label>
            <Select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value as 'ALL' | RiskLevel)}>
              {REVIEW_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level === 'ALL' ? 'All urgent scans' : level}
                </option>
              ))}
            </Select>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Priority cards"
          subtitle={`${visibleQueue.length} item${visibleQueue.length === 1 ? '' : 's'} in the current queue`}
          icon={<ShieldCheck className="h-4 w-4" aria-hidden />}
        />
        <CardBody className="pt-5">
          {!visibleQueue.length ? (
            <div className="rounded-xl border border-dashed border-hairline bg-surface-2/60 p-8 text-center text-[13px] text-ink-muted">
              No scans match the current risk filter. Try widening the queue or check back after more analysis runs.
            </div>
          ) : (
            <div className="space-y-3">
              {visibleQueue.map((scan) => (
                <div key={scan.scan_id} className="rounded-xl border border-hairline bg-surface-2/60 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
                          #{scan.scan_id}
                        </span>
                        <span className="rounded-full border border-cyan-400/20 bg-cyan-500/8 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-cyan-200">
                          {scan.scan_type}
                        </span>
                        <RiskBadge level={scan.risk_level} score={scan.risk_score} />
                      </div>

                      <Link
                        to={`/dashboard/scans/${scan.scan_id}`}
                        className="mt-3 block truncate text-[16px] font-semibold text-ink transition-colors hover:text-cyan-300"
                        title={scan.target_label}
                      >
                        {scan.target_label}
                      </Link>

                      <div className="mt-2 flex flex-wrap items-center gap-4 text-[12px] text-ink-muted">
                        <span>{scan.prediction}</span>
                        <span>•</span>
                        <span>{relativeTime(scan.created_at)}</span>
                        <span>•</span>
                        <span>{formatDateTime(scan.created_at)}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleDownload(scan.scan_id)}
                        loading={downloadingId === scan.scan_id}
                        loadingText="Preparing…"
                      >
                        <Download className="h-4 w-4" aria-hidden />
                        Download report
                      </Button>
                      <Link
                        to={`/dashboard/scans/${scan.scan_id}`}
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-hairline bg-surface-3 px-3.5 text-[13px] font-medium text-ink transition-colors hover:border-cyan-400/30 hover:text-cyan-200"
                      >
                        Open review
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
