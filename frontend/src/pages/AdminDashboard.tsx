import { useMemo, useState } from 'react'
import {
  Activity,
  BarChart3,
  Brain,
  Gauge,
  RefreshCw,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { StatTile } from '@/components/StatTile'
import { ScanHistoryTable } from '@/components/ScanHistoryTable'
import {
  RiskDistributionChart,
  ScanTrendChart,
  ScanTypeChart,
  TopIndicatorsChart,
} from '@/components/charts/Charts'
import { useToast } from '@/components/ui/Toast'
import { useAsync } from '@/hooks/useAsync'
import { useAuth } from '@/hooks/useAuth'
import { dashboardService } from '@/services/dashboardService'
import { adminService } from '@/services/adminService'
import { apiErrorMessage } from '@/services/api'
import { formatDate, formatDateTime, humanise, initials } from '@/lib/format'
import { cn } from '@/lib/cn'
import { RISK_LEVELS } from '@/lib/risk'
import type { AdminAnalytics, AdminUserRow, RiskLevel, StatCard } from '@/types'

const STAT_ICON: Record<string, typeof Activity> = {
  total_users: Users,
  total_admins: ShieldCheck,
  new_users_last_7_days: UserCheck,
  total_scans: ScanLine,
  fraud_detections: ShieldAlert,
  high_risk_percentage: TrendingUp,
  average_risk_score: Gauge,
}

const STAT_ACCENT: Record<string, 'cyan' | 'emerald' | 'amber' | 'red' | 'violet'> = {
  total_users: 'cyan',
  total_admins: 'violet',
  new_users_last_7_days: 'emerald',
  total_scans: 'cyan',
  fraud_detections: 'red',
  high_risk_percentage: 'amber',
  average_risk_score: 'violet',
}

export default function AdminDashboard() {
  const toast = useToast()
  const { user: currentUser } = useAuth()
  const { data, loading, error, reload, setData } = useAsync<AdminAnalytics>(
    () => dashboardService.adminAnalytics(),
    [],
  )
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const [retraining, setRetraining] = useState(false)
  const [suspiciousFilter, setSuspiciousFilter] = useState<'ALL' | RiskLevel>('ALL')

  const filteredSuspiciousScans = useMemo(() => {
    const items = data?.recent_suspicious_scans ?? []
    if (suspiciousFilter === 'ALL') return items
    return items.filter((scan) => scan.risk_level === suspiciousFilter)
  }, [data?.recent_suspicious_scans, suspiciousFilter])

  function exportSuspiciousCsv() {
    if (!filteredSuspiciousScans.length) {
      toast.push('There are no suspicious scans to export for this view.', 'info')
      return
    }

    const header = ['scan_id', 'scan_type', 'target_label', 'prediction', 'risk_score', 'risk_level', 'status', 'created_at']
    const csv = [
      header.join(','),
      ...filteredSuspiciousScans.map((scan) =>
        [
          scan.scan_id,
          scan.scan_type,
          scan.target_label,
          scan.prediction,
          scan.risk_score,
          scan.risk_level,
          scan.status,
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
    anchor.download = `fraudshield-suspicious-scans-${suspiciousFilter.toLowerCase()}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${filteredSuspiciousScans.length} scan${filteredSuspiciousScans.length === 1 ? '' : 's'}.`)
  }

  async function toggleUser(row: AdminUserRow) {
    const nextActive = !row.is_active
    const verb = nextActive ? 'Re-enable' : 'Suspend'
    if (!window.confirm(`${verb} ${row.email}?`)) return

    setTogglingId(row.id)
    try {
      const updated = await adminService.setUserStatus(row.id, nextActive)
      toast.success(`${row.email} is now ${updated.is_active ? 'active' : 'suspended'}`)
      if (data) {
        setData({
          ...data,
          users: data.users.map((item) =>
            item.id === row.id ? { ...item, is_active: updated.is_active } : item,
          ),
        })
      }
    } catch (caught) {
      toast.error(apiErrorMessage(caught, 'The account status could not be changed.'))
    } finally {
      setTogglingId(null)
    }
  }

  async function triggerRetrain() {
    setRetraining(true)
    try {
      const result = await adminService.retrainModels()
      toast.success(
        result.retrained
          ? `Retraining completed with ${result.feedback_examples} feedback examples.`
          : 'Retraining was skipped because there are not enough feedback samples yet.',
      )
      if (data) {
        setData({
          ...data,
          model_status: {
            ...data.model_status,
            training_runs: Number(result.training_runs ?? data.model_status.training_runs ?? 0),
            last_training: String(result.last_training ?? data.model_status.last_training ?? 'never'),
          },
        })
      }
      await reload()
    } catch (caught) {
      toast.error(apiErrorMessage(caught, 'The retraining job could not be started.'))
    } finally {
      setRetraining(false)
    }
  }

  const modelEntries = Object.entries(data?.model_status ?? {})

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Platform analytics"
        description="Fleet-wide detection performance, the fraud patterns firing most often, and every registered account."
        icon={<BarChart3 className="h-5 w-5" aria-hidden />}
        action={
          <Button variant="secondary" size="sm" onClick={reload} disabled={loading}>
            <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} aria-hidden />
            Refresh
          </Button>
        }
      />

      {error && (
        <Alert tone="danger" className="mb-5" title="Could not load platform analytics">
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

      {(data?.stats?.length ?? 0) > 4 && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {(data?.stats ?? []).slice(4, 8).map((stat: StatCard) => {
            const Icon = STAT_ICON[stat.key] ?? Activity
            return (
              <StatTile
                key={stat.key}
                label={stat.label}
                value={stat.unit === '%' ? `${stat.value.toFixed(1)}` : stat.value}
                unit={stat.unit}
                delta={stat.delta}
                hint={stat.hint}
                accent={STAT_ACCENT[stat.key] ?? 'violet'}
                icon={<Icon className="h-4 w-4" aria-hidden />}
              />
            )
          })}
        </div>
      )}

      {/* Trend + risk mix */}
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader
            title="Platform scan activity — last 14 days"
            subtitle="Every account, split by outcome"
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
            subtitle="Across all scans on the platform"
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

      {/* Indicators + types */}
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader
            title="Most frequent fraud indicators"
            subtitle="Which signals fire most often across all scans"
            icon={<ShieldAlert className="h-4 w-4" aria-hidden />}
          />
          <CardBody className="pt-5">
            {loading && !data ? (
              <div className="h-[260px] animate-pulse rounded-xl bg-surface-2/60" />
            ) : data && data.top_indicators.length > 0 ? (
              <TopIndicatorsChart data={data.top_indicators} />
            ) : (
              <EmptyState
                title="No indicators recorded yet"
                description="Once scans start detecting fraud patterns, the most common ones will be ranked here."
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Scans by type"
            subtitle="Which surfaces users check most"
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
      </div>

      {/* Suspicious scans */}
      <Card className="mt-5 overflow-hidden">
        <CardHeader
          title="Recent high-risk activity"
          subtitle="Latest scans that scored HIGH or CRITICAL, across every account"
          icon={<ShieldAlert className="h-4 w-4" aria-hidden />}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 rounded-lg border border-hairline bg-abyss/40 p-1">
                {['ALL', ...RISK_LEVELS.filter((level) => level !== 'LOW' && level !== 'MEDIUM')].map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setSuspiciousFilter(level as 'ALL' | RiskLevel)}
                    className={cn(
                      'rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors',
                      suspiciousFilter === level
                        ? 'bg-cyan-500/20 text-cyan-200'
                        : 'text-ink-faint hover:text-ink',
                    )}
                  >
                    {level === 'ALL' ? 'All' : level}
                  </button>
                ))}
              </div>
              <Button variant="secondary" size="sm" onClick={exportSuspiciousCsv} disabled={loading || !filteredSuspiciousScans.length}>
                Export CSV
              </Button>
            </div>
          }
        />
        <ScanHistoryTable
          items={filteredSuspiciousScans}
          loading={loading && !data}
          compact
          emptyTitle="No high-risk scans yet"
          emptyDescription="Nothing on the platform has crossed the HIGH threshold. That is a good sign."
        />
      </Card>

      {/* Users */}
      <Card className="mt-5 overflow-hidden">
        <CardHeader
          title="Registered accounts"
          subtitle={
            loading && !data
              ? 'Loading…'
              : `${data?.users.length ?? 0} account${data?.users.length === 1 ? '' : 's'} · ${
                  data?.total_admins ?? 0
                } administrator(s)`
          }
          icon={<Users className="h-4 w-4" aria-hidden />}
        />
        <UsersTable
          users={data?.users ?? []}
          loading={loading && !data}
          currentUserId={currentUser?.id}
          togglingId={togglingId}
          onToggle={toggleUser}
        />
      </Card>

      {data?.drift_summary && (
        <Card className="mt-5">
          <CardHeader
            title="AI governance snapshot"
            subtitle="Model drift, feedback coverage and retraining readiness"
            icon={<Brain className="h-4 w-4" aria-hidden />}
          />
          <CardBody className="grid gap-4 pt-5 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-hairline bg-abyss/40 p-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-ink-faint">Feedback coverage</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{data.drift_summary.feedback_coverage.toFixed(1)}%</p>
            </div>
            <div className="rounded-xl border border-hairline bg-abyss/40 p-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-ink-faint">Retaining ready</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{data.drift_summary.retraining_ready ? 'Yes' : 'No'}</p>
            </div>
            <div className="rounded-xl border border-hairline bg-abyss/40 p-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-ink-faint">Average accuracy</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{data.drift_summary.avg_model_accuracy.toFixed(2)}</p>
            </div>
            <div className="rounded-xl border border-hairline bg-abyss/40 p-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-ink-faint">Drift risk</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{data.drift_summary.model_drift_risk}</p>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Model status */}
      {modelEntries.length > 0 && (
        <Card className="mt-5">
          <CardHeader
            title="Detection engine status"
            subtitle="Live state of the models backing each scan type"
            icon={<Brain className="h-4 w-4" aria-hidden />}
            action={
              <Button variant="secondary" size="sm" onClick={triggerRetrain} disabled={retraining || loading}>
                <RefreshCw className={retraining ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} aria-hidden />
                {retraining ? 'Retraining…' : 'Retrain now'}
              </Button>
            }
          />
          <CardBody className="grid gap-4 pt-5 md:grid-cols-2 xl:grid-cols-3">
            {modelEntries.map(([name, status]) => (
              <ModelCard key={name} name={name} status={status} />
            ))}
          </CardBody>
        </Card>
      )}

      {data && (
        <p className="mt-5 text-center text-[11px] text-ink-faint">
          Snapshot generated {formatDateTime(data.generated_at)} · {data.total_scans} scans ·{' '}
          {data.fraud_detections} fraud detections · {data.high_risk_percentage.toFixed(1)}% high
          risk
        </p>
      )}
    </div>
  )
}

function UsersTable({
  users,
  loading,
  currentUserId,
  togglingId,
  onToggle,
}: {
  users: AdminUserRow[]
  loading: boolean
  currentUserId?: number
  togglingId: number | null
  onToggle: (row: AdminUserRow) => void
}) {
  if (loading) {
    return (
      <div className="space-y-2 p-5">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-12 animate-pulse rounded-xl bg-surface-2/60" />
        ))}
      </div>
    )
  }

  if (users.length === 0) {
    return (
      <EmptyState
        title="No accounts found"
        description="Run the seed script to create the demo and administrator accounts."
      />
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left">
        <thead>
          <tr className="border-y border-hairline bg-abyss/40">
            {['Account', 'Role', 'Scans', 'High risk', 'Joined', 'Status'].map((heading) => (
              <th
                key={heading}
                scope="col"
                className="px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint"
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map((row) => {
            const isSelf = row.id === currentUserId
            return (
              <tr
                key={row.id}
                className="border-b border-hairline/50 transition-colors last:border-0 hover:bg-white/[0.02]"
              >
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-hairline bg-surface-2 text-[11px] font-semibold text-cyan-200">
                      {initials(row.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-ink">
                        {row.name}
                        {isSelf && <span className="ml-1.5 text-[11px] text-ink-faint">(you)</span>}
                      </p>
                      <p className="truncate text-[11px] text-ink-faint">{row.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <Badge tone={row.role === 'ADMIN' ? 'violet' : 'neutral'}>{row.role}</Badge>
                </td>
                <td className="px-5 py-3 text-[13px] tabular-nums text-ink-muted">
                  {row.scan_count}
                </td>
                <td className="px-5 py-3">
                  <span
                    className={cn(
                      'text-[13px] font-medium tabular-nums',
                      row.high_risk_count > 0 ? 'text-orange-300' : 'text-ink-faint',
                    )}
                  >
                    {row.high_risk_count}
                  </span>
                </td>
                <td className="px-5 py-3 whitespace-nowrap text-[12px] text-ink-faint">
                  {formatDate(row.created_at)}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <Badge tone={row.is_active ? 'success' : 'danger'}>
                      {row.is_active ? 'Active' : 'Suspended'}
                    </Badge>
                    <button
                      type="button"
                      disabled={isSelf || togglingId === row.id}
                      onClick={() => onToggle(row)}
                      title={
                        isSelf
                          ? 'You cannot change your own account status'
                          : row.is_active
                            ? 'Suspend this account'
                            : 'Re-enable this account'
                      }
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                        row.is_active
                          ? 'border-hairline text-ink-muted hover:border-red-500/35 hover:text-red-200'
                          : 'border-hairline text-ink-muted hover:border-emerald-500/35 hover:text-emerald-200',
                      )}
                    >
                      {row.is_active ? (
                        <UserX className="h-3 w-3" aria-hidden />
                      ) : (
                        <UserCheck className="h-3 w-3" aria-hidden />
                      )}
                      {togglingId === row.id ? '…' : row.is_active ? 'Suspend' : 'Enable'}
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ModelCard({ name, status }: { name: string; status: unknown }) {
  const detail = (status ?? {}) as Record<string, unknown>
  const trained = detail.trained === true || detail.available === true
  const entries = Object.entries(detail).filter(([, value]) => typeof value !== 'object')

  return (
    <div className="rounded-xl border border-hairline bg-abyss/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-semibold text-ink">{humanise(name)}</p>
        <Badge tone={trained ? 'success' : 'warning'}>{trained ? 'Ready' : 'Heuristic'}</Badge>
      </div>
      {entries.length > 0 ? (
        <dl className="mt-3 space-y-1.5">
          {entries.map(([key, value]) => (
            <div key={key} className="flex items-start justify-between gap-3">
              <dt className="text-[11px] text-ink-faint">{humanise(key)}</dt>
              <dd className="max-w-[55%] break-words text-right font-mono text-[11px] text-ink-muted">
                {typeof value === 'boolean'
                  ? value
                    ? 'yes'
                    : 'no'
                  : value === null || value === undefined
                    ? '—'
                    : String(value)}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-2 text-[12px] text-ink-faint">No details reported.</p>
      )}
    </div>
  )
}
