import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import type { RiskLevel } from '@/types'
import { riskTheme } from '@/lib/risk'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider',
  {
    variants: {
      tone: {
        neutral: 'border-hairline bg-surface-2 text-ink-muted',
        brand: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200',
        success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
        warning: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
        danger: 'border-red-500/35 bg-red-500/10 text-red-300',
        violet: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />
}

export function RiskBadge({
  level,
  score,
  className,
}: {
  level: RiskLevel
  score?: number
  className?: string
}) {
  const theme = riskTheme(level)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider',
        theme.bg,
        theme.border,
        theme.text,
        className,
      )}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: theme.hex }}
        aria-hidden
      />
      {level}
      {score !== undefined && <span className="tabular-nums opacity-80">{score.toFixed(0)}</span>}
    </span>
  )
}
