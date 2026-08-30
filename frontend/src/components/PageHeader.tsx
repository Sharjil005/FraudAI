import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function PageHeader({
  eyebrow,
  title,
  description,
  icon,
  action,
  className,
}: {
  eyebrow?: string
  title: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'mb-6 flex flex-wrap items-end justify-between gap-4 animate-fade-up',
        className,
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          {icon && (
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-cyan-400/25 bg-cyan-400/10 text-cyan-300">
              {icon}
            </span>
          )}
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300/80">
                {eyebrow}
              </p>
            )}
            <h1 className="truncate text-xl font-semibold tracking-tight text-ink sm:text-2xl">
              {title}
            </h1>
          </div>
        </div>
        {description && (
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink-muted">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
