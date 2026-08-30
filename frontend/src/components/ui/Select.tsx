import { forwardRef, type SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, label, id, children, ...props },
  ref,
) {
  const selectId = id ?? props.name
  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={selectId}
          className="mb-1.5 block text-xs font-medium tracking-wide text-ink-muted"
        >
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'h-11 w-full appearance-none rounded-xl border border-hairline bg-abyss/80 pl-3.5 pr-10 text-sm text-ink',
            'outline-none transition-colors focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-400/10',
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
          aria-hidden
        />
      </div>
    </div>
  )
})
