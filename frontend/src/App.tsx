import { lazy, Suspense, type ReactNode } from 'react'
import { Route, Routes } from 'react-router-dom'
import { PublicLayout } from '@/layouts/PublicLayout'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { AdminRoute, GuestOnlyRoute, ProtectedRoute } from '@/components/RouteGuards'

const Landing = lazy(() => import('@/pages/Landing'))
const Login = lazy(() => import('@/pages/Login'))
const Register = lazy(() => import('@/pages/Register'))
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const UrlScanner = lazy(() => import('@/pages/UrlScanner'))
const MessageScanner = lazy(() => import('@/pages/MessageScanner'))
const DocumentScanner = lazy(() => import('@/pages/DocumentScanner'))
const QrScanner = lazy(() => import('@/pages/QrScanner'))
const ScanHistory = lazy(() => import('@/pages/ScanHistory'))
const ScanDetails = lazy(() => import('@/pages/ScanDetails'))
const ReviewQueue = lazy(() => import('@/pages/ReviewQueue'))
const AdminDashboard = lazy(() => import('@/pages/AdminDashboard'))
const SocialCircle = lazy(() => import('@/pages/SocialCircle'))
const NotFound = lazy(() => import('@/pages/NotFound'))

function withPageFallback(page: ReactNode) {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-[40vh] place-items-center text-sm text-ink-muted" role="status">
          Loading page...
        </div>
      }
    >
      {page}
    </Suspense>
  )
}

/**
 * Route table.
 *
 *  /                        public marketing page
 *  /login, /register        guest-only (authenticated users bounce to /dashboard)
 *  /dashboard/*             requires a valid session
 *  /dashboard/admin         additionally requires the ADMIN role
 */
export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route element={<PublicLayout />}>
        <Route index element={withPageFallback(<Landing />)} />
      </Route>

      {/* Auth */}
      <Route element={<GuestOnlyRoute />}>
        <Route path="/login" element={withPageFallback(<Login />)} />
        <Route path="/register" element={withPageFallback(<Register />)} />
      </Route>

      {/* Authenticated app */}
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={withPageFallback(<Dashboard />)} />
          <Route path="scan/url" element={withPageFallback(<UrlScanner />)} />
          <Route path="scan/message" element={withPageFallback(<MessageScanner />)} />
          <Route path="scan/document" element={withPageFallback(<DocumentScanner />)} />
          <Route path="scan/qr" element={withPageFallback(<QrScanner />)} />
          <Route path="history" element={withPageFallback(<ScanHistory />)} />
          <Route path="review" element={withPageFallback(<ReviewQueue />)} />
          <Route path="scans/:scanId" element={withPageFallback(<ScanDetails />)} />
          <Route path="social" element={withPageFallback(<SocialCircle />)} />

          {/* Admin-only */}
          <Route element={<AdminRoute />}>
            <Route path="admin" element={withPageFallback(<AdminDashboard />)} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={withPageFallback(<NotFound />)} />
    </Routes>
  )
}
