import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Clock3,
  FileText,
  Gauge,
  Link2,
  MessageSquare,
  QrCode,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { PageHeader } from '@/components/PageHeader'
import { StatTile } from '@/components/StatTile'
import { ScanHistoryTable } from '@/components/ScanHistoryTable'
import {
  RiskDistributionChart,
  ScanTrendChart,
  ScanTypeChart,
} from '@/components/charts/Charts'
import { useAsync } from '@/hooks/useAsync'
import { useAuth } from '@/hooks/useAuth'
import ThreatAlertsList from '@/components/ThreatAlertsList'
import { dashboardService } from '@/services/dashboardService'
import { api } from '@/services/api'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { DashboardSummary, StatCard } from '@/types'

const STAT_ICON: Record<string, typeof Activity> = {
  total_scans: ScanLine,
  threats_detected: AlertTriangle,
  high_risk_scans: AlertTriangle,
  safe_scans: ShieldCheck,
  average_risk_score: Gauge,
  detection_rate: TrendingUp,
}

const STAT_ACCENT: Record<string, 'cyan' | 'emerald' | 'amber' | 'red' | 'violet'> = {
  total_scans: 'cyan',
  threats_detected: 'red',
  high_risk_scans: 'amber',
  safe_scans: 'emerald',
  average_risk_score: 'violet',
  detection_rate: 'cyan',
}

const QUICK_ACTIONS = [
  {
    to: '/dashboard/scan/url',
    icon: Link2,
    title: 'Scan a URL',
    body: 'Check a link for phishing before you click it.',
    accent: 'border-cyan-400/25 bg-cyan-400/10 text-cyan-300',
  },
  {
    to: '/dashboard/scan/message',
    icon: MessageSquare,
    title: 'Scan a message',
    body: 'Paste an SMS, WhatsApp or email to detect scam patterns.',
    accent: 'border-indigo-400/25 bg-indigo-400/10 text-indigo-300',
  },
  {
    to: '/dashboard/scan/document',
    icon: FileText,
    title: 'Scan a document',
    body: 'Upload an invoice, screenshot or PDF for anomaly review.',
    accent: 'border-pink-400/25 bg-pink-400/10 text-pink-300',
  },
  {
    to: '/dashboard/scan/qr',
    icon: QrCode,
    title: 'Scan a QR / UPI',
    body: 'Inspect payment QR codes and UPI collect links for fraud traps.',
    accent: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
  },
]

type CapabilityState = {
  online: boolean
  modelCount: number
  ocrAvailable: boolean
  fallbackText: string
}

export default function Dashboard() {
  const { user } = useAuth()
  const { data, loading, error, reload } = useAsync<DashboardSummary>(
    () => dashboardService.summary(),
    [],
  )
  const [capabilities, setCapabilities] = useState<CapabilityState>({
    online: false,
    modelCount: 0,
    ocrAvailable: false,
    fallbackText: 'Checking engine status…',
  })
  const [compareA, setCompareA] = useState<number | ''>('')
  const [compareB, setCompareB] = useState<number | ''>('')

  const comparisonScans = data?.recent_scans ?? []

  const selectedComparison = comparisonScans.filter((scan) =>
    scan.scan_id === compareA || scan.scan_id === compareB,
  )

  const comparisonDelta =
    selectedComparison.length === 2
      ? selectedComparison[0].risk_score - selectedComparison[1].risk_score
      : 0

  const comparisonSummary =
    selectedComparison.length === 2
      ? comparisonDelta > 0
        ? `Scan #${selectedComparison[0].scan_id} is ${comparisonDelta} points higher than #${selectedComparison[1].scan_id}.`
        : comparisonDelta < 0
          ? `Scan #${selectedComparison[1].scan_id} is ${Math.abs(comparisonDelta)} points higher than #${selectedComparison[0].scan_id}.`
          : 'Both recent scans are at the same risk score.'
      : 'Select two recent scans to compare risk delta and detection type.'

  const threatAlerts = (data?.recent_scans ?? [])
    .filter((scan) => scan.risk_level === 'HIGH' || scan.risk_level === 'CRITICAL')
    .slice(0, 3)

  const slaSummary = data?.sla_summary ?? {
    overdue_cases: 0,
    aging_buckets: [],
    average_hours_in_queue: 0,
    escalated_cases: 0,
    pending_review: 0,
  }

  const workloadSummary = data?.workload_summary ?? {
    my_assigned_cases: 0,
    unassigned_cases: 0,
    escalated_workload: 0,
    reviewed_today: 0,
    active_analysts: 0,
  }

  const confidenceSummary = data?.confidence_summary ?? {
    low: 0,
    medium: 0,
    high: 0,
    review_required: 0,
  }

  const topIndicators = data?.top_indicators ?? []

  useEffect(() => {
    let active = true

    api
      .get('/scan/capabilities')
      .then(({ data: response }) => {
        if (!active) return
        const modelEntries = response?.models ?? {}
        setCapabilities({
          online: true,
          modelCount: Object.keys(modelEntries).length,
          ocrAvailable: Boolean(response?.ocr?.available),
          fallbackText:
            response?.ocr?.fallback ??
            (response?.ocr?.available ? 'OCR is enabled and ready' : 'OCR fallback is active'),
        })
      })
      .catch(() => {
        if (!active) return
        setCapabilities({
          online: false,
          modelCount: 0,
          ocrAvailable: false,
          fallbackText: 'Backend unavailable. Start the API to enable live scans.',
        })
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!comparisonScans.length) return
    if (compareA === '' && compareB === '') {
      setCompareA(comparisonScans[0]?.scan_id ?? '')
      setCompareB(comparisonScans[1]?.scan_id ?? comparisonScans[0]?.scan_id ?? '')
    }
  }, [comparisonScans, compareA, compareB])

  const firstName = (user?.name ?? '').split(' ')[0] || 'there'

  return (
    <div>
      <PageHeader
        eyebrow="Overview"
        title={`Welcome back, ${firstName}`}
        description="Your fraud-detection activity at a glance — volumes, risk mix and the scans you ran most recently."
        action={
          <Button variant="secondary" size="sm" onClick={reload} disabled={loading}>
            <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} aria-hidden />
            Refresh
          </Button>
        }
      />

      {error && (
        <Alert tone="danger" className="mb-5" title="Could not load your dashboard">
          {error}
        </Alert>
      )}

      <div className="mb-5">
        <ThreatAlertsList />
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {loading && !data
            ? Array.from({ length: 4 }).map((_, index) => <SkeletonCard key={index} />)
            : (data?.stats ?? []).slice(0, 4).map((stat: StatCard) => {
                const Icon = STAT_ICON[stat.key] ?? Activity
                return (
                  <StatTile
                    key={stat.key}
                    label={stat.label}
                    value={stat.unit === '%' ? `${stat.value.toFixed(1)}` : stat.value}
                    unit={stat.unit}
                    delta={stat.delta}
                    hint={stat.hint}
                    accent={STAT_ACCENT[stat.key] ?? 'cyan'}
                    icon={<Icon className="h-4 w-4" aria-hidden />}
                  />
                )
              })}
        </div>

        <Card>
          <CardHeader
            title="Engine status"
            subtitle="Live analysis backend"
            icon={<ShieldCheck className="h-4 w-4" aria-hidden />}
          />
          <CardBody className="pt-5">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'h-2.5 w-2.5 rounded-full',
                  capabilities.online ? 'bg-emerald-400' : 'bg-amber-400',
                )}
                aria-hidden
              />
              <p className="text-[13px] font-medium text-ink">
                {capabilities.online ? 'API connected' : 'Waiting for backend'}
              </p>
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-ink-muted">
              {capabilities.fallbackText}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-lg border border-hairline bg-surface-2/60 px-2.5 py-2">
                <span className="block text-ink-faint">Models</span>
                <span className="mt-1 block font-semibold text-ink">{capabilities.modelCount}</span>
              </div>
              <div className="rounded-lg border border-hairline bg-surface-2/60 px-2.5 py-2">
                <span className="block text-ink-faint">OCR</span>
                <span className="mt-1 block font-semibold text-ink">
                  {capabilities.ocrAvailable ? 'ready' : 'fallback'}
                </span>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {QUICK_ACTIONS.map((action) => (
          <Link key={action.to} to={action.to} className="group">
            <Card className="h-full transition-colors hover:border-cyan-400/30">
              <CardBody className="flex items-start gap-3.5 p-5">
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${action.accent}`}
                >
                  <action.icon className="h-4.5 w-4.5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
                    {action.title}
                    <ArrowRight
                      className="h-3.5 w-3.5 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-cyan-300"
                      aria-hidden
                    />
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">{action.body}</p>
                </div>
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="mt-5">
        <CardHeader
          title="Recent scan comparison"
          subtitle="Compare two recent analyses to see how risk changed over time"
          icon={<TrendingUp className="h-4 w-4" aria-hidden />}
        />
        <CardBody className="pt-5">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
                Compare scan A
              </label>
              <select
                value={compareA}
                onChange={(event) => setCompareA(event.target.value ? Number(event.target.value) : '')}
                className="w-full rounded-xl border border-hairline bg-abyss/80 px-3 py-2.5 text-[13px] text-ink outline-none focus:border-cyan-400/60"
              >
                {comparisonScans.map((scan) => (
                  <option key={scan.scan_id} value={scan.scan_id}>
                    #{scan.scan_id} · {scan.scan_type}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
                Compare scan B
              </label>
              <select
                value={compareB}
                onChange={(event) => setCompareB(event.target.value ? Number(event.target.value) : '')}
                className="w-full rounded-xl border border-hairline bg-abyss/80 px-3 py-2.5 text-[13px] text-ink outline-none focus:border-cyan-400/60"
              >
                {comparisonScans.map((scan) => (
                  <option key={scan.scan_id} value={scan.scan_id}>
                    #{scan.scan_id} · {scan.scan_type}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <div className="w-full rounded-xl border border-hairline bg-surface-2/70 px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
                  Difference
                </p>
                <p className="mt-1 text-lg font-semibold text-ink">
                  {selectedComparison.length === 2 ? `${Math.abs(comparisonDelta)} pts` : '—'}
                </p>
              </div>
            </div>
          </div>

          {selectedComparison.length === 2 ? (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {selectedComparison.map((scan) => (
                <div key={scan.scan_id} className="rounded-xl border border-hairline bg-surface-2/60 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
                        Scan #{scan.scan_id}
                      </p>
                      <p className="mt-1 text-[15px] font-semibold text-ink">{scan.scan_type}</p>
                    </div>
                    <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-200">
                      {scan.risk_level}
                    </span>
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[11px] text-ink-faint">Risk score</p>
                      <p className="text-3xl font-semibold tabular-nums text-ink">{scan.risk_score}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-ink-faint">Date</p>
                      <p className="text-[12px] text-ink-muted">{formatDateTime(scan.created_at)}</p>
                    </div>
                  </div>
                  <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-abyss">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-indigo-500 to-violet-500"
                      style={{ width: `${Math.min(scan.risk_score, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-5 rounded-xl border border-dashed border-hairline bg-surface-2/50 p-4 text-[13px] text-ink-faint">
              {comparisonSummary}
            </p>
          )}

          {selectedComparison.length === 2 && (
            <p className="mt-5 rounded-xl border border-hairline bg-surface-2/60 p-3 text-[13px] text-ink-muted">
              {comparisonSummary}
            </p>
          )}
        </CardBody>
      </Card>

      <Card className="mt-5 border-orange-500/20 bg-orange-500/5">
        <CardHeader
          title="Threat watchlist"
          subtitle="Highest-risk recent activity that needs attention"
          icon={<AlertTriangle className="h-4 w-4" aria-hidden />}
        />
        <CardBody className="pt-5">
          {threatAlerts.length === 0 ? (
            <p className="text-[13px] text-ink-muted">
              No recent scans are in the HIGH or CRITICAL band. The current risk posture looks stable.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              {threatAlerts.map((scan) => (
                <div key={scan.scan_id} className="rounded-xl border border-orange-500/20 bg-surface-2/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
                      #{scan.scan_id}
                    </p>
                    <span className="rounded-full border border-orange-500/25 bg-orange-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-orange-200">
                      {scan.risk_level}
                    </span>
                  </div>
                  <p className="mt-2 text-[15px] font-semibold text-ink">{scan.scan_type}</p>
                  <p className="mt-1 truncate text-[12px] text-ink-muted">{scan.target_label}</p>
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <p className="text-2xl font-semibold tabular-nums text-ink">{scan.risk_score}</p>
                    <span className="text-[11px] text-ink-faint">Risk</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-abyss">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-orange-400 to-red-500"
                      style={{ width: `${Math.min(scan.risk_score, 100)}%` }}
                    />
                  </div>
                  <p className="mt-3 text-[11px] leading-relaxed text-ink-muted">
                    Recommended action: review this result, verify the target, and escalate if the content is being used in a live workflow.
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Card className="mt-5 border-cyan-500/20 bg-cyan-500/5">
        <CardHeader
          title="SLA & queue health"
          subtitle="Operational pressure on the current review backlog"
          icon={<Clock3 className="h-4 w-4" aria-hidden />}
        />
        <CardBody className="pt-5">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-hairline bg-surface/70 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">Overdue</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{slaSummary.overdue_cases}</p>
              <p className="mt-1 text-[11px] text-ink-muted">cases older than 24h</p>
            </div>
            <div className="rounded-xl border border-hairline bg-surface/70 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">Pending</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{slaSummary.pending_review}</p>
              <p className="mt-1 text-[11px] text-ink-muted">awaiting review</p>
            </div>
            <div className="rounded-xl border border-hairline bg-surface/70 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">Escalated</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{slaSummary.escalated_cases}</p>
              <p className="mt-1 text-[11px] text-ink-muted">high priority</p>
            </div>
            <div className="rounded-xl border border-hairline bg-surface/70 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">Avg queue</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{slaSummary.average_hours_in_queue.toFixed(1)}h</p>
              <p className="mt-1 text-[11px] text-ink-muted">current age</p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {slaSummary.aging_buckets.length === 0 ? (
              <p className="text-[13px] text-ink-muted">No backlog yet — run more scans to populate the queue.</p>
            ) : (
              slaSummary.aging_buckets.map((bucket) => (
                <div key={bucket.label} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-[12px]">
                    <span className="font-medium text-ink">{bucket.label}</span>
                    <span className="text-ink-faint">{bucket.count} cases</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-abyss">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-indigo-500 to-violet-500"
                      style={{ width: `${Math.min((bucket.count / Math.max(slaSummary.aging_buckets[0]?.count ?? 1, 1)) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </CardBody>
      </Card>

      <Card className="mt-5 border-violet-500/20 bg-violet-500/5">
        <CardHeader
          title="Analyst workload"
          subtitle="Assignment balance and review throughput across the current queue"
          icon={<Activity className="h-4 w-4" aria-hidden />}
        />
        <CardBody className="pt-5">
          <div className="grid gap-3 md:grid-cols-5">
            <div className="rounded-xl border border-hairline bg-surface/70 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">Assigned</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{workloadSummary.my_assigned_cases}</p>
              <p className="mt-1 text-[11px] text-ink-muted">your queue</p>
            </div>
            <div className="rounded-xl border border-hairline bg-surface/70 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">Unassigned</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{workloadSummary.unassigned_cases}</p>
              <p className="mt-1 text-[11px] text-ink-muted">need triage</p>
            </div>
            <div className="rounded-xl border border-hairline bg-surface/70 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">Escalated</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{workloadSummary.escalated_workload}</p>
              <p className="mt-1 text-[11px] text-ink-muted">high priority</p>
            </div>
            <div className="rounded-xl border border-hairline bg-surface/70 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">Reviewed</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{workloadSummary.reviewed_today}</p>
              <p className="mt-1 text-[11px] text-ink-muted">last 24h</p>
            </div>
            <div className="rounded-xl border border-hairline bg-surface/70 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">Analysts</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{workloadSummary.active_analysts}</p>
              <p className="mt-1 text-[11px] text-ink-muted">active today</p>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card className="mt-5 border-amber-500/20 bg-amber-500/5">
        <CardHeader
          title="Confidence calibration"
          subtitle="A quick view of which scans still need analyst review"
          icon={<Gauge className="h-4 w-4" aria-hidden />}
        />
        <CardBody className="pt-5">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-hairline bg-surface/70 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">Low</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{confidenceSummary.low}</p>
              <p className="mt-1 text-[11px] text-ink-muted">confidence</p>
            </div>
            <div className="rounded-xl border border-hairline bg-surface/70 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">Medium</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{confidenceSummary.medium}</p>
              <p className="mt-1 text-[11px] text-ink-muted">watchlist</p>
            </div>
            <div className="rounded-xl border border-hairline bg-surface/70 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">High</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{confidenceSummary.high}</p>
              <p className="mt-1 text-[11px] text-ink-muted">auto-accepted</p>
            </div>
            <div className="rounded-xl border border-hairline bg-surface/70 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">Review</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{confidenceSummary.review_required}</p>
              <p className="mt-1 text-[11px] text-ink-muted">manual review</p>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card className="mt-5 border-cyan-500/20 bg-cyan-500/5">
        <CardHeader
          title="Top signal indicators"
          subtitle="The fraud patterns showing up most often in your recent scans"
          icon={<TrendingUp className="h-4 w-4" aria-hidden />}
        />
        <CardBody className="pt-5">
          {topIndicators.length === 0 ? (
            <p className="text-[13px] text-ink-muted">
              Indicator trends will appear as soon as you run more scans.
            </p>
          ) : (
            <div className="space-y-3">
              {topIndicators.map((indicator, index) => (
                <div key={`${indicator.code}-${index}`} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-[12px]">
                    <span className="font-medium text-ink">{indicator.label}</span>
                    <span className="text-ink-faint">{indicator.count} hits</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-abyss">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-indigo-500 to-violet-500"
                      style={{ width: `${Math.min((indicator.count / Math.max(topIndicators[0]?.count ?? 1, 1)) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Charts */}
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader
            title="Scan activity — last 14 days"
            subtitle="Daily volume split by outcome"
            icon={<Activity className="h-4 w-4" aria-hidden />}
          />
          <CardBody className="pt-5">
            {loading && !data ? (
              <div className="h-[260px] animate-pulse rounded-xl bg-surface-2/60" />
            ) : (
              <ScanTrendChart data={data?.trend ?? []} />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Risk distribution"
            subtitle="How your scans landed across the four bands"
            icon={<Gauge className="h-4 w-4" aria-hidden />}
          />
          <CardBody className="pt-5">
            {loading && !data ? (
              <div className="h-[260px] animate-pulse rounded-xl bg-surface-2/60" />
            ) : (
              <RiskDistributionChart data={data?.risk_distribution ?? []} />
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1.6fr]">
        <Card>
          <CardHeader
            title="Scans by type"
            subtitle="Which surfaces you check most"
            icon={<ScanLine className="h-4 w-4" aria-hidden />}
          />
          <CardBody className="pt-5">
            {loading && !data ? (
              <div className="h-[230px] animate-pulse rounded-xl bg-surface-2/60" />
            ) : (
              <ScanTypeChart data={data?.scan_type_distribution ?? []} />
            )}
          </CardBody>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader
            title="Recent scans"
            subtitle="Your five most recent analyses"
            icon={<Activity className="h-4 w-4" aria-hidden />}
            action={
              <Link
                to="/dashboard/history"
                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-cyan-300 transition-colors hover:text-cyan-200"
              >
                View all
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            }
          />
          <ScanHistoryTable
            items={data?.recent_scans ?? []}
            loading={loading && !data}
            compact
            emptyTitle="No scans yet"
            emptyDescription="Run your first analysis and it will show up here instantly."
            emptyAction={
              <Link
                to="/dashboard/scan/url"
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-500 px-4 text-[13px] font-semibold text-slate-950 transition hover:brightness-110"
              >
                Scan your first URL
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            }
          />
        </Card>
      </div>

      {data && (
        <p className="mt-5 text-center text-[11px] text-ink-faint">
          Snapshot generated {formatDateTime(data.generated_at)} · detection rate{' '}
          {data.detection_rate.toFixed(1)}% across {data.total_scans} scans
        </p>
      )}
    </div>
  )
}
