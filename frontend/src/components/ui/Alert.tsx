import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, ShieldAlert, X } from 'lucide-react'
import { cn } from '@/lib/cn'

type AlertTone = 'info' | 'success' | 'warning' | 'danger'

const TONES: Record<AlertTone, { className: string; icon: ReactNode }> = {
  info: {
    className: 'border-sky-500/30 bg-sky-500/10 text-sky-100',
    icon: <Info className="h-4 w-4 text-sky-300" aria-hidden />,
  },
  success: {
    className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100',
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-300" aria-hidden />,
  },
  warning: {
    className: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
    icon: <AlertTriangle className="h-4 w-4 text-amber-300" aria-hidden />,
  },
  danger: {
    className: 'border-red-500/35 bg-red-500/10 text-red-100',
    icon: <ShieldAlert className="h-4 w-4 text-red-300" aria-hidden />,
  },
}

export function Alert({
  tone = 'info',
  title,
  children,
  onDismiss,
  className,
}: {
  tone?: AlertTone
  title?: string
  children?: ReactNode
  onDismiss?: () => void
  className?: string
}) {
  const config = TONES[tone]
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-3 rounded-xl border px-4 py-3 text-sm animate-fade-in',
        config.className,
        className,
      )}
    >
      <span className="mt-0.5 shrink-0">{config.icon}</span>
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn('text-[13px] opacity-90', title && 'mt-0.5')}>{children}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded-md p-1 opacity-60 transition hover:bg-white/10 hover:opacity-100"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </div>
  )
}
