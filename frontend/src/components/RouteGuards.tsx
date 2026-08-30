import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { FullPageLoader } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'

/** Requires a valid session; bounces to /login and remembers the target route. */
export function ProtectedRoute() {
  const { isAuthenticated, initialising } = useAuth()
  const location = useLocation()

  if (initialising) return <FullPageLoader message="Verifying your session…" />
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  return <Outlet />
}

/** Requires the ADMIN role on top of a valid session. */
export function AdminRoute() {
  const { isAdmin, initialising, isAuthenticated } = useAuth()
  const location = useLocation()

  if (initialising) return <FullPageLoader message="Checking permissions…" />
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if (!isAdmin) {
    return (
      <EmptyState
        icon={<ShieldAlert className="h-6 w-6 text-red-300" aria-hidden />}
        title="Administrator access required"
        description="Your account does not have permission to view platform analytics. Sign in with an admin account to continue."
        action={
          <Link
            to="/dashboard"
            className="inline-flex h-9 items-center rounded-xl border border-hairline bg-surface-2 px-3.5 text-[13px] font-medium text-ink transition-colors hover:border-cyan-400/30 hover:bg-surface-3"
          >
            Back to my dashboard
          </Link>
        }
        className="py-24"
      />
    )
  }
  return <Outlet />
}

/** Keeps signed-in users out of /login and /register. */
export function GuestOnlyRoute() {
  const { isAuthenticated, initialising } = useAuth()
  if (initialising) return <FullPageLoader />
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  return <Outlet />
}
