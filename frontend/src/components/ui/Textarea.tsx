import { forwardRef, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?: string
  error?: string | null
  counter?: boolean
  maxCount?: number
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, label, hint, error, counter, maxCount, id, value, ...props },
  ref,
) {
  const textareaId = id ?? props.name ?? label?.toLowerCase().replace(/\s+/g, '-')
  const length = typeof value === 'string' ? value.length : 0

  return (
    <div className="w-full">
      {(label || counter) && (
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          {label && (
            <label
              htmlFor={textareaId}
              className="block text-xs font-medium tracking-wide text-ink-muted"
            >
              {label}
            </label>
          )}
          {counter && (
            <span
              className={cn(
                'text-[11px] tabular-nums',
                maxCount && length > maxCount ? 'text-red-300' : 'text-ink-faint',
              )}
            >
              {length.toLocaleString()}
              {maxCount ? ` / ${maxCount.toLocaleString()}` : ''}
            </span>
          )}
        </div>
      )}
      <textarea
        ref={ref}
        id={textareaId}
        value={value}
        aria-invalid={Boolean(error)}
        className={cn(
          'w-full resize-y rounded-xl border bg-abyss/80 px-3.5 py-3 text-sm leading-relaxed text-ink placeholder:text-ink-faint/70',
          'transition-colors outline-none',
          'focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-400/10',
          error ? 'border-red-500/60' : 'border-hairline hover:border-hairline/80',
          className,
        )}
        {...props}
      />
      {error ? (
        <p className="mt-1.5 text-xs text-red-300">{error}</p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-ink-faint">{hint}</p>
      )}
    </div>
  )
})
