import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-hairline bg-surface/70 shadow-card backdrop-blur-sm',
        className,
      )}
      {...props}
    />
  )
}

/** `title` is widened to ReactNode, so the native string-only attribute is dropped. */
interface CardHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode
  subtitle?: ReactNode
  icon?: ReactNode
  action?: ReactNode
}

export function CardHeader({
  className,
  title,
  subtitle,
  icon,
  action,
  children,
  ...props
}: CardHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-start justify-between gap-3 border-b border-hairline/70 px-5 py-4',
        className,
      )}
      {...props}
    >
      {children ?? (
        <>
          <div className="flex min-w-0 items-start gap-3">
            {icon && (
              <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-cyan-400/25 bg-cyan-400/10 text-cyan-300">
                {icon}
              </span>
            )}
            <div className="min-w-0">
              {title && <h3 className="truncate text-[15px] font-semibold text-ink">{title}</h3>}
              {subtitle && <p className="mt-0.5 text-xs text-ink-faint">{subtitle}</p>}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </>
      )}
    </div>
  )
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 py-4', className)} {...props} />
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 border-t border-hairline/70 px-5 py-3',
        className,
      )}
      {...props}
    />
  )
}
