import { ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/cn'
import { severityTheme } from '@/lib/risk'
import type { Indicator } from '@/types'

/**
 * Explainable-AI panel: every indicator that contributed to the score, with
 * its severity, weight and a plain-language detail line.
 */
export function IndicatorList({
  indicators,
  limit,
  className,
}: {
  indicators: Indicator[]
  limit?: number
  className?: string
}) {
  const scoring = indicators.filter((indicator) => indicator.weight > 0)
  const informational = indicators.filter((indicator) => indicator.weight <= 0)
  const ordered = [...scoring, ...informational]
  const visible = limit ? ordered.slice(0, limit) : ordered
  const maxWeight = Math.max(1, ...scoring.map((indicator) => indicator.weight))

  if (!visible.length) {
    return (
      <div
        className={cn(
          'flex items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-4 py-3.5',
          className,
        )}
      >
        <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden />
        <p className="text-[13px] text-emerald-100">
          No fraud indicators were triggered. Nothing in this item matched our risk patterns.
        </p>
      </div>
    )
  }

  return (
    <ul className={cn('space-y-2.5', className)}>
      {visible.map((indicator) => {
        const theme = severityTheme(indicator.severity)
        const share = indicator.weight > 0 ? (indicator.weight / maxWeight) * 100 : 0

        return (
          <li
            key={`${indicator.code}-${indicator.label}`}
            className="rounded-xl border border-hairline bg-surface-2/50 p-3.5 transition-colors hover:border-hairline/80 hover:bg-surface-2"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    'shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                    theme.className,
                  )}
                >
                  {theme.label}
                </span>
                <p className="truncate text-[13px] font-medium text-ink">{indicator.label}</p>
              </div>
              {indicator.weight > 0 ? (
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink-faint">
                  +{indicator.weight.toFixed(0)} pts
                </span>
              ) : (
                <span className="shrink-0 font-mono text-[11px] text-ink-faint">context</span>
              )}
            </div>

            <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{indicator.detail}</p>

            {share > 0 && (
              <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-abyss">
                <div
                  className="h-full rounded-full transition-[width] duration-700 ease-out"
                  style={{
                    width: `${share}%`,
                    background: `linear-gradient(90deg, ${severityColour(indicator.severity)}aa, ${severityColour(indicator.severity)})`,
                  }}
                />
              </div>
            )}

            <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-ink-faint/70">
              {indicator.code}
            </p>
          </li>
        )
      })}
    </ul>
  )
}

function severityColour(severity: string): string {
  switch (severity) {
    case 'critical':
      return '#ef4444'
    case 'high':
      return '#f97316'
    case 'medium':
      return '#f59e0b'
    case 'low':
      return '#22c55e'
    default:
      return '#38bdf8'
  }
}
