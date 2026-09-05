import { Link } from 'react-router-dom'
import { AlertTriangle, ShieldAlert, ArrowRight, RefreshCw, Loader2, MessageSquare, Link2, FileText, X } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useAsync } from '@/hooks/useAsync'
import { socialService } from '@/services/socialService'
import { formatDateTime } from '@/lib/format'
import type { ThreatAlert } from '@/types'

// Use valid Badge component tones: 'success' | 'warning' | 'danger' | 'neutral'
const RISK_ACCENT: Record<string, 'neutral' | 'success' | 'warning' | 'danger'> = {
  LOW: 'success',
  MEDIUM: 'warning',
  HIGH: 'danger',
  CRITICAL: 'danger',
}

const TYPE_ICON: Record<string, typeof Link2> = {
  URL: Link2,
  MESSAGE: MessageSquare,
  DOCUMENT: FileText,
}

export default function ThreatAlertsList() {
  // Query unread alerts only (passing true)
  const { data: alerts = [], loading, reload } = useAsync<ThreatAlert[]>(
    () => socialService.getThreatAlerts(true),
    []
  )

  const alertsList = alerts || []

  async function handleDismiss(alertId: number) {
    try {
      await socialService.markAlertAsRead(alertId)
      reload()
    } catch (caught) {
      // Quiet fail
    }
  }

  if (loading && alertsList.length === 0) {
    return (
      <Card className="border border-hairline/60 bg-abyss/20 backdrop-blur-sm">
        <CardBody className="flex items-center justify-center py-6 text-ink-faint">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Checking for safety circle alerts...
        </CardBody>
      </Card>
    )
  }

  if (alertsList.length === 0) return null

  return (
    <Card className="border border-red-500/20 bg-red-500/5 backdrop-blur-xl animate-fade-in">
      <CardHeader
        title="Safety Circle Alerts"
        subtitle="Recent fraud threats shared by your friends and family"
        icon={<ShieldAlert className="h-4.5 w-4.5 text-red-400" />}
        action={
          <Button variant="outline" size="sm" onClick={reload} disabled={loading} className="h-8 py-0">
            <RefreshCw className={loading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
          </Button>
        }
      />
      <CardBody className="p-5 space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {alertsList.slice(0, 4).map((alert) => {
            const Icon = TYPE_ICON[alert.scan_type] || AlertTriangle
            const tone = RISK_ACCENT[alert.risk_level] || 'danger'
            return (
              <div
                key={alert.id}
                className="flex flex-col justify-between p-4 rounded-xl border border-red-500/20 bg-abyss/45 hover:border-red-500/40 transition relative group"
              >
                <div className="space-y-2.5">
                  {/* Header info */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="grid h-8 w-8 place-items-center rounded-lg border border-red-500/20 bg-red-500/10 text-red-400">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-xs font-semibold text-ink leading-tight">
                          {alert.sender_name}
                        </p>
                        <p className="text-[10px] text-ink-faint leading-tight">
                          {formatDateTime(alert.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={tone} className="font-semibold text-[10px] py-0 px-2 uppercase">
                        {alert.risk_level} ({alert.risk_score.toFixed(0)})
                      </Badge>
                      <button
                        onClick={() => handleDismiss(alert.id)}
                        className="p-1 rounded-lg text-ink-faint hover:bg-red-500/15 hover:text-red-400 transition"
                        title="Dismiss Alert"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Scanned target */}
                  <div className="rounded-lg bg-surface-2/40 border border-hairline/40 p-2.5">
                    <p className="text-[10px] uppercase font-semibold tracking-wider text-ink-faint">
                      Target Scanned ({alert.scan_type})
                    </p>
                    <p className="mt-1 text-xs font-medium text-ink truncate max-w-[320px]">
                      {alert.target_label}
                    </p>
                  </div>

                  {/* Note */}
                  {alert.note && (
                    <div className="bg-amber-500/5 border-l-2 border-amber-500/40 p-2.5 rounded-r-lg">
                      <p className="text-[10px] uppercase font-bold tracking-wider text-amber-300/80">
                        Friend's Warning
                      </p>
                      <p className="mt-0.5 text-xs text-ink-muted leading-relaxed italic">
                        “{alert.note}”
                      </p>
                    </div>
                  )}
                </div>

                {/* Footer link */}
                <div className="mt-4 flex justify-between items-center pt-2 border-t border-hairline/30">
                  {alert.group_name ? (
                    <Badge tone="neutral" className="text-[9px] py-0">
                      via group: {alert.group_name}
                    </Badge>
                  ) : (
                    <span className="text-[9px] text-ink-faint">Shared privately</span>
                  )}
                  <Link
                    to={`/dashboard/scans/${alert.scan_id}`}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-300 hover:text-cyan-200"
                  >
                    View Details
                    <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      </CardBody>
    </Card>
  )
}
