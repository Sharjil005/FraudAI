import { Loader2, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/cn'

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-4 w-4 animate-spin text-cyan-300', className)} aria-hidden />
}

/** Full-panel loading state with an animated scanning shield. */
export function LoadingPanel({
  title = 'Loading',
  message,
  className,
}: {
  title?: string
  message?: string
  className?: string
}) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center gap-4 px-6 py-16', className)}
      role="status"
      aria-live="polite"
    >
      <div className="relative grid h-16 w-16 place-items-center">
        <span className="absolute inset-0 rounded-full border border-cyan-400/40 animate-pulse-ring" />
        <span
          className="absolute inset-0 rounded-full border border-cyan-400/25 animate-pulse-ring"
          style={{ animationDelay: '0.8s' }}
        />
        <span className="grid h-12 w-12 place-items-center rounded-2xl border border-cyan-400/30 bg-cyan-400/10">
          <ShieldCheck className="h-6 w-6 text-cyan-300" aria-hidden />
        </span>
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-ink">{title}</p>
        {message && <p className="mt-1 max-w-sm text-xs text-ink-faint">{message}</p>}
      </div>
      <div className="h-1 w-40 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full w-1/3 animate-marquee rounded-full bg-gradient-to-r from-cyan-400 to-indigo-500" />
      </div>
    </div>
  )
}

/** Blocking screen used while the auth session is being validated. */
export function FullPageLoader({ message = 'Securing your session…' }: { message?: string }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-void">
      <LoadingPanel title="FraudShield AI" message={message} />
    </div>
  )
}
