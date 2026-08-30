import { Link } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/cn'

/** The FraudShield AI wordmark + shield glyph. */
export function Logo({
  to = '/',
  size = 'md',
  showWordmark = true,
  className,
}: {
  to?: string | null
  size?: 'sm' | 'md' | 'lg'
  showWordmark?: boolean
  className?: string
}) {
  const glyph = {
    sm: 'h-8 w-8 rounded-lg',
    md: 'h-9 w-9 rounded-xl',
    lg: 'h-11 w-11 rounded-2xl',
  }[size]
  const icon = { sm: 'h-4 w-4', md: 'h-[18px] w-[18px]', lg: 'h-5 w-5' }[size]
  const text = { sm: 'text-sm', md: 'text-[15px]', lg: 'text-lg' }[size]

  const content = (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span
        className={cn(
          'relative grid shrink-0 place-items-center border border-cyan-400/30 bg-gradient-to-br from-cyan-400/20 to-indigo-500/20 text-cyan-300 shadow-[0_0_24px_-8px_rgba(34,211,238,0.7)]',
          glyph,
        )}
      >
        <ShieldCheck className={icon} aria-hidden />
      </span>
      {showWordmark && (
        <span className={cn('font-semibold tracking-tight text-ink', text)}>
          Fraud<span className="text-gradient">Shield</span>
          <span className="ml-1 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300/80">
            AI
          </span>
        </span>
      )}
    </span>
  )

  if (!to) return content
  return (
    <Link to={to} className="inline-flex items-center rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50">
      {content}
    </Link>
  )
}
