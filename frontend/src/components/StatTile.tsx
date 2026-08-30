import type { ReactNode } from 'react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'

export function StatTile({
  label,
  value,
  unit,
  delta,
  hint,
  icon,
  accent = 'cyan',
  className,
}: {
  label: string
  value: number | string
  unit?: string | null
  delta?: number | null
  hint?: string | null
  icon?: ReactNode
  accent?: 'cyan' | 'emerald' | 'amber' | 'red' | 'violet'
  className?: string
}) {
  const accents: Record<string, string> = {
    cyan: 'border-cyan-400/25 bg-cyan-400/10 text-cyan-300',
    emerald: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
    amber: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
    red: 'border-red-500/25 bg-red-500/10 text-red-300',
    violet: 'border-violet-500/25 bg-violet-500/10 text-violet-300',
  }

  const glows: Record<string, string> = {
    cyan: 'from-cyan-400/12',
    emerald: 'from-emerald-400/12',
    amber: 'from-amber-400/12',
    red: 'from-red-400/12',
    violet: 'from-violet-400/12',
  }

  return (
    <Card
      className={cn(
        'group relative overflow-hidden p-5 transition-colors hover:border-hairline/90',
        className,
      )}
    >
      <div
        className={cn(
          'pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br to-transparent opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100',
          glows[accent],
        )}
        aria-hidden
      />
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
          {label}
        </p>
        {icon && (
          <span className={cn('grid h-8 w-8 place-items-center rounded-xl border', accents[accent])}>
            {icon}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-end gap-2">
        <span className="text-[1.75rem] font-semibold leading-none tabular-nums text-ink">
          {typeof value === 'number' ? formatNumber(value) : value}
        </span>
        {unit && <span className="pb-0.5 text-sm text-ink-muted">{unit}</span>}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {delta !== null && delta !== undefined && (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
              delta >= 0
                ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                : 'border-red-500/25 bg-red-500/10 text-red-300',
            )}
          >
            {delta >= 0 ? (
              <TrendingUp className="h-3 w-3" aria-hidden />
            ) : (
              <TrendingDown className="h-3 w-3" aria-hidden />
            )}
            {delta >= 0 ? '+' : ''}
            {delta.toFixed(1)}%
          </span>
        )}
        {hint && <p className="text-[11px] leading-snug text-ink-faint">{hint}</p>}
      </div>
    </Card>
  )
}
