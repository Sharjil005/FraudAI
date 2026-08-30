import { Link, useLocation } from 'react-router-dom'
import { ArrowLeft, Compass, Link2, ShieldQuestion } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { Card, CardBody } from '@/components/ui/Card'
import { useAuth } from '@/hooks/useAuth'

const SUGGESTIONS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/dashboard/scan/url', label: 'URL Scanner' },
  { to: '/dashboard/scan/message', label: 'Message Scanner' },
  { to: '/dashboard/scan/document', label: 'Document Scanner' },
  { to: '/dashboard/history', label: 'Scan History' },
]

export default function NotFound() {
  const location = useLocation()
  const { isAuthenticated } = useAuth()

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden px-5 py-16">
      <div
        className="pointer-events-none absolute inset-0 grid-noise"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-[120px]"
        aria-hidden
      />

      <div className="relative w-full max-w-lg text-center">
        <div className="flex justify-center">
          <Logo size="md" />
        </div>

        <p className="mt-10 text-[64px] font-semibold leading-none tracking-tight text-gradient sm:text-[80px]">
          404
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-ink">This page could not be found</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-muted">
          The address{' '}
          <code className="rounded-md border border-hairline bg-surface-2 px-1.5 py-0.5 font-mono text-[12px] text-cyan-200">
            {location.pathname}
          </code>{' '}
          does not match any route on FraudShield. It may have been moved, or the link you followed
          was incomplete.
        </p>

        <div className="mt-7 flex flex-wrap justify-center gap-2.5">
          <Link
            to={isAuthenticated ? '/dashboard' : '/'}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-500 px-5 text-[13px] font-semibold text-slate-950 transition hover:brightness-110"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {isAuthenticated ? 'Back to dashboard' : 'Back to home'}
          </Link>
          <Link
            to="/dashboard/scan/url"
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-hairline bg-surface-2 px-5 text-[13px] font-medium text-ink transition-colors hover:border-cyan-400/30"
          >
            <Link2 className="h-4 w-4" aria-hidden />
            Scan a URL
          </Link>
        </div>

        {isAuthenticated && (
          <Card className="mt-8 text-left">
            <CardBody className="p-5">
              <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
                <Compass className="h-3.5 w-3.5" aria-hidden />
                Jump to
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {SUGGESTIONS.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="rounded-lg border border-hairline bg-surface-2/60 px-2.5 py-1.5 text-[12px] font-medium text-ink-muted transition-colors hover:border-cyan-400/35 hover:text-ink"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </CardBody>
          </Card>
        )}

        <p className="mt-8 flex items-center justify-center gap-1.5 text-[11px] text-ink-faint">
          <ShieldQuestion className="h-3.5 w-3.5" aria-hidden />
          If you reached this page from a FraudShield report link, the scan may have been deleted.
        </p>
      </div>
    </div>
  )
}
