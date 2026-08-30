import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, ShieldCheck } from 'lucide-react'
import { Logo } from '@/components/Logo'

/**
 * Split-screen shell shared by Login and Register: form on the left,
 * product reassurance panel on the right.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  highlights,
}: {
  title: string
  subtitle: string
  children: ReactNode
  footer: ReactNode
  highlights: string[]
}) {
  return (
    <div className="relative grid min-h-dvh bg-void text-ink lg:grid-cols-[1fr_1.05fr]">
      <div className="pointer-events-none absolute inset-0 grid-noise" aria-hidden />
      <div
        className="pointer-events-none absolute -left-32 top-0 h-96 w-96 rounded-full bg-cyan-500/10 blur-[120px]"
        aria-hidden
      />

      {/* Form column */}
      <div className="relative flex flex-col justify-center px-5 py-12 sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <Logo to="/" size="lg" />
          <h1 className="mt-8 text-2xl font-semibold tracking-tight text-ink">{title}</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">{subtitle}</p>
          <div className="mt-7">{children}</div>
          <div className="mt-6 text-[13px] text-ink-muted">{footer}</div>
        </div>
      </div>

      {/* Reassurance column */}
      <div className="relative hidden flex-col justify-center border-l border-hairline/60 bg-abyss/60 px-16 lg:flex">
        <div
          className="pointer-events-none absolute bottom-0 right-0 h-96 w-96 rounded-full bg-violet-500/10 blur-[120px]"
          aria-hidden
        />
        <div className="relative max-w-md">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/8 px-3 py-1 text-[11px] font-medium text-cyan-200">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            Explainable AI fraud detection
          </span>
          <p className="mt-6 text-3xl font-semibold leading-[1.15] tracking-tight text-ink">
            Detect Digital Fraud Before It{' '}
            <span className="text-gradient">Detects You.</span>
          </p>
          <ul className="mt-8 space-y-3.5">
            {highlights.map((line) => (
              <li key={line} className="flex items-start gap-3 text-[14px] text-ink-muted">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
                {line}
              </li>
            ))}
          </ul>
          <div className="mt-10 rounded-2xl border border-hairline bg-surface/60 p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
              Privacy
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
              Analysis runs entirely on your own backend. Submitted links are never visited, and no
              content is sent to any third-party AI service.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Small helper that wires a form's submit handler with a busy guard. */
export function useSubmitGuard() {
  const [submitting, setSubmitting] = useState(false)

  function guard(handler: () => Promise<void>) {
    return async (event: FormEvent) => {
      event.preventDefault()
      if (submitting) return
      setSubmitting(true)
      try {
        await handler()
      } finally {
        setSubmitting(false)
      }
    }
  }

  return { submitting, guard }
}

export function AuthFooterLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="font-medium text-cyan-300 transition-colors hover:text-cyan-200">
      {children}
    </Link>
  )
}
