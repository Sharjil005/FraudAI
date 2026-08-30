import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'

const buttonVariants = cva(
  'relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-glow select-none',
  {
    variants: {
      variant: {
        primary:
          'bg-gradient-to-r from-cyan-400 to-indigo-500 text-slate-950 font-semibold shadow-[0_10px_30px_-12px_rgba(34,211,238,0.65)] hover:shadow-[0_14px_40px_-12px_rgba(34,211,238,0.9)] hover:brightness-110 active:brightness-95',
        secondary:
          'bg-surface-2 text-ink border border-hairline hover:bg-surface-3 hover:border-cyan-400/30',
        outline:
          'border border-cyan-400/35 text-cyan-200 hover:bg-cyan-400/10 hover:border-cyan-400/60',
        ghost: 'text-ink-muted hover:text-ink hover:bg-white/5',
        danger:
          'bg-red-500/15 text-red-200 border border-red-500/35 hover:bg-red-500/25 hover:border-red-500/60',
        link: 'text-cyan-300 underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        sm: 'h-9 px-3.5 text-[13px]',
        md: 'h-11 px-5',
        lg: 'h-12 px-7 text-[15px]',
        icon: 'h-10 w-10 p-0',
      },
      block: {
        true: 'w-full',
        false: '',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md', block: false },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean
  loadingText?: string
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, block, loading = false, loadingText, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {loading && loadingText ? loadingText : children}
    </button>
  )
})

export { buttonVariants }
