import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-6 py-14 text-center animate-fade-in',
        className,
      )}
    >
      {icon && (
        <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-hairline bg-surface-2 text-ink-faint">
          {icon}
        </span>
      )}
      <p className="text-sm font-medium text-ink">{title}</p>
      {description && <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-ink-faint">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
