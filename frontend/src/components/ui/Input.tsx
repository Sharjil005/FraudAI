import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string | null
  icon?: ReactNode
  trailing?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, label, hint, error, icon, trailing, id, ...props },
  ref,
) {
  const inputId = id ?? props.name ?? label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-xs font-medium tracking-wide text-ink-muted"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint">
            {icon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(error)}
          className={cn(
            'h-11 w-full rounded-xl border bg-abyss/80 px-3.5 text-sm text-ink placeholder:text-ink-faint/70',
            'transition-colors outline-none',
            'focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-400/10',
            icon && 'pl-10',
            trailing && 'pr-11',
            error ? 'border-red-500/60' : 'border-hairline hover:border-hairline/80',
            className,
          )}
          {...props}
        />
        {trailing && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-faint">
            {trailing}
          </span>
        )}
      </div>
      {error ? (
        <p className="mt-1.5 text-xs text-red-300">{error}</p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-ink-faint">{hint}</p>
      )}
    </div>
  )
})
