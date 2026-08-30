import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/cn'

const NAV = [
  { label: 'Platform', href: '/#platform' },
  { label: 'How it works', href: '/#how-it-works' },
  { label: 'Detection', href: '/#detection' },
  { label: 'FAQ', href: '/#faq' },
]

/** Marketing shell: sticky translucent nav + footer. */
export function PublicLayout() {
  const { isAuthenticated } = useAuth()
  const [open, setOpen] = useState(false)

  return (
    <div className="flex min-h-dvh flex-col bg-void text-ink">
      <header className="sticky top-0 z-50 border-b border-hairline/60 bg-void/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-5 lg:px-8">
          <Logo to="/" />

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2 text-[13px] font-medium text-ink-muted transition-colors hover:bg-white/5 hover:text-ink"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2.5 md:flex">
            <ThemeToggle />
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="inline-flex h-10 items-center rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-500 px-4 text-[13px] font-semibold text-slate-950 shadow-[0_10px_30px_-12px_rgba(34,211,238,0.65)] transition hover:brightness-110"
              >
                Open dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="inline-flex h-10 items-center rounded-xl px-3.5 text-[13px] font-medium text-ink-muted transition-colors hover:bg-white/5 hover:text-ink"
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="inline-flex h-10 items-center rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-500 px-4 text-[13px] font-semibold text-slate-950 shadow-[0_10px_30px_-12px_rgba(34,211,238,0.65)] transition hover:brightness-110"
                >
                  Get started free
                </Link>
              </>
            )}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
          </Button>
        </div>

        {open && (
          <div className="border-t border-hairline/60 bg-abyss/95 px-5 pb-5 pt-3 md:hidden animate-fade-in">
            <nav className="flex flex-col">
              {NAV.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-2 py-2.5 text-sm text-ink-muted transition-colors hover:bg-white/5 hover:text-ink"
                >
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="mt-3 flex flex-col gap-2.5 border-t border-hairline/60 pt-4">
              <div className="mb-1 flex justify-end">
                <ThemeToggle />
              </div>
              {isAuthenticated ? (
                <Link
                  to="/dashboard"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-500 text-sm font-semibold text-slate-950"
                >
                  Open dashboard
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setOpen(false)}
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-hairline bg-surface-2 text-sm font-medium text-ink"
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setOpen(false)}
                    className="inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-500 text-sm font-semibold text-slate-950"
                  >
                    Get started free
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-hairline/60 bg-abyss/60">
        <div className="mx-auto w-full max-w-7xl px-5 py-10 lg:px-8">
          <div className="grid gap-8 md:grid-cols-[1.4fr_1fr_1fr]">
            <div>
              <Logo to="/" />
              <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-ink-faint">
                Explainable AI for phishing links, scam messages and suspicious documents. Every
                verdict comes with the evidence behind it.
              </p>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
                Product
              </p>
              <ul className="mt-3 space-y-2 text-[13px] text-ink-muted">
                <li>
                  <FooterLink to="/dashboard/scan/url">URL Scanner</FooterLink>
                </li>
                <li>
                  <FooterLink to="/dashboard/scan/message">Message Scanner</FooterLink>
                </li>
                <li>
                  <FooterLink to="/dashboard/scan/document">Document Scanner</FooterLink>
                </li>
                <li>
                  <FooterLink to="/dashboard/history">Scan History</FooterLink>
                </li>
              </ul>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-faint">
                Resources
              </p>
              <ul className="mt-3 space-y-2 text-[13px] text-ink-muted">
                <li>
                  <a
                    href="/docs"
                    className="transition-colors hover:text-cyan-300"
                    target="_blank"
                    rel="noreferrer"
                  >
                    API documentation
                  </a>
                </li>
                <li>
                  <FooterLink to="/register">Create an account</FooterLink>
                </li>
                <li>
                  <FooterLink to="/login">Sign in</FooterLink>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-9 flex flex-col gap-2 border-t border-hairline/60 pt-5 text-[11px] text-ink-faint sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} FraudShield AI. Built as an academic capstone project.</p>
            <p>
              Risk scores are advisory. Always verify independently before acting on a financial
              request.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

function FooterLink({ to, children }: { to: string; children: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn('transition-colors hover:text-cyan-300', isActive && 'text-cyan-300')
      }
    >
      {children}
    </NavLink>
  )
}
