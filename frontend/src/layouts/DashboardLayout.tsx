import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  FileText,
  History,
  LayoutDashboard,
  Link2,
  LogOut,
  Menu,
  MessageSquare,
  Shield,
  ShieldAlert,
  X,
} from 'lucide-react'
import { Logo } from '@/components/Logo'
import { Badge } from '@/components/ui/Badge'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/cn'
import { initials } from '@/lib/format'

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  end?: boolean
  adminOnly?: boolean
}

const NAV_SECTIONS: { heading: string; items: NavItem[] }[] = [
  {
    heading: 'Overview',
    items: [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true }],
  },
  {
    heading: 'Analyse',
    items: [
      { to: '/dashboard/scan/url', label: 'URL Scanner', icon: Link2 },
      { to: '/dashboard/scan/message', label: 'Message Scanner', icon: MessageSquare },
      { to: '/dashboard/scan/document', label: 'Document Scanner', icon: FileText },
    ],
  },
  {
    heading: 'Records',
    items: [
      { to: '/dashboard/history', label: 'Scan History', icon: History },
      { to: '/dashboard/review', label: 'Review Queue', icon: ShieldAlert },
    ],
  },
  {
    heading: 'Administration',
    items: [{ to: '/dashboard/admin', label: 'Platform Analytics', icon: BarChart3, adminOnly: true }],
  },
]

export function DashboardLayout() {
  const { user, isAdmin, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  const sections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.adminOnly || isAdmin),
  })).filter((section) => section.items.length > 0)

  return (
    <div className="min-h-dvh bg-void text-ink">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 -z-10 grid-noise" aria-hidden />
      <div
        className="pointer-events-none fixed -left-40 -top-40 -z-10 h-96 w-96 rounded-full bg-cyan-500/8 blur-[120px]"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed -bottom-40 -right-40 -z-10 h-96 w-96 rounded-full bg-violet-500/8 blur-[120px]"
        aria-hidden
      />

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-hairline/60 bg-abyss/70 backdrop-blur-xl lg:flex">
        <div className="flex h-16 shrink-0 items-center border-b border-hairline/60 px-5">
          <Logo to="/" />
        </div>
        <SidebarNav sections={sections} />
        <UserFooter name={user?.name ?? 'Account'} email={user?.email ?? ''} isAdmin={isAdmin} onLogout={handleLogout} />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close navigation"
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-hairline bg-abyss animate-fade-in">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-hairline/60 px-5">
              <Logo to="/" />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-white/5 hover:text-ink"
                aria-label="Close navigation"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <SidebarNav sections={sections} />
            <UserFooter
              name={user?.name ?? 'Account'}
              email={user?.email ?? ''}
              isAdmin={isAdmin}
              onLogout={handleLogout}
            />
          </aside>
        </div>
      )}

      {/* Content */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-hairline/60 bg-void/80 px-5 backdrop-blur-xl lg:px-8">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="rounded-lg p-2 text-ink-muted transition-colors hover:bg-white/5 hover:text-ink lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>

          <div className="lg:hidden">
            <Logo to="/dashboard" showWordmark={false} size="sm" />
          </div>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-300 sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
              Engines online
            </span>
            <Link
              to="/dashboard/scan/url"
              className="hidden h-9 items-center rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-500 px-3.5 text-[13px] font-semibold text-slate-950 transition hover:brightness-110 sm:inline-flex"
            >
              New scan
            </Link>
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl border border-hairline bg-surface-2 text-[12px] font-semibold text-cyan-200">
                {initials(user?.name ?? '?')}
              </span>
              <div className="hidden leading-tight sm:block">
                <p className="max-w-[10rem] truncate text-[13px] font-medium text-ink">
                  {user?.name}
                </p>
                <p className="text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                  {user?.role}
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl px-5 py-7 lg:px-8 lg:py-9">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function SidebarNav({ sections }: { sections: { heading: string; items: NavItem[] }[] }) {
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-5 scrollbar-none">
      {sections.map((section) => (
        <div key={section.heading} className="mb-5 last:mb-0">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint/80">
            {section.heading}
          </p>
          <ul className="space-y-0.5">
            {section.items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all',
                      isActive
                        ? 'bg-cyan-400/10 text-cyan-200'
                        : 'text-ink-muted hover:bg-white/5 hover:text-ink',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span
                          className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-cyan-400"
                          aria-hidden
                        />
                      )}
                      <item.icon
                        className={cn(
                          'h-4 w-4 shrink-0 transition-colors',
                          isActive ? 'text-cyan-300' : 'text-ink-faint group-hover:text-ink-muted',
                        )}
                        aria-hidden
                      />
                      {item.label}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

function UserFooter({
  name,
  email,
  isAdmin,
  onLogout,
}: {
  name: string
  email: string
  isAdmin: boolean
  onLogout: () => void
}) {
  return (
    <div className="shrink-0 border-t border-hairline/60 p-3">
      <div className="rounded-xl border border-hairline bg-surface/60 p-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-cyan-400/25 bg-cyan-400/10 text-[12px] font-semibold text-cyan-200">
            {initials(name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-ink">{name}</p>
            <p className="truncate text-[11px] text-ink-faint">{email}</p>
          </div>
        </div>
        {isAdmin && (
          <Badge tone="violet" className="mt-2.5">
            <Shield className="h-3 w-3" aria-hidden />
            Administrator
          </Badge>
        )}
        <button
          type="button"
          onClick={onLogout}
          className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-lg border border-hairline px-3 py-2 text-[12px] font-medium text-ink-muted transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-200"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden />
          Sign out
        </button>
      </div>
    </div>
  )
}
