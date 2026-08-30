import { Link } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  FileText,
  Gauge,
  Link2,
  MessageSquare,
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
import { dashboardService } from '@/services/dashboardService'
import { formatDateTime } from '@/lib/format'
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
]

export default function Dashboard() {
  const { user } = useAuth()
  const { data, loading, error, reload } = useAsync<DashboardSummary>(
    () => dashboardService.summary(),
    [],
  )

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

      {/* Stats */}
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

      {/* Quick actions */}
      <div className="mt-5 grid gap-4 md:grid-cols-3">
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
