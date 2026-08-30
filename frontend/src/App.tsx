import { Route, Routes } from 'react-router-dom'
import { PublicLayout } from '@/layouts/PublicLayout'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { AdminRoute, GuestOnlyRoute, ProtectedRoute } from '@/components/RouteGuards'
import Landing from '@/pages/Landing'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import Dashboard from '@/pages/Dashboard'
import UrlScanner from '@/pages/UrlScanner'
import MessageScanner from '@/pages/MessageScanner'
import DocumentScanner from '@/pages/DocumentScanner'
import ScanHistory from '@/pages/ScanHistory'
import ScanDetails from '@/pages/ScanDetails'
import ReviewQueue from '@/pages/ReviewQueue'
import AdminDashboard from '@/pages/AdminDashboard'
import NotFound from '@/pages/NotFound'

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
        <Route index element={<Landing />} />
      </Route>

      {/* Auth */}
      <Route element={<GuestOnlyRoute />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      {/* Authenticated app */}
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="scan/url" element={<UrlScanner />} />
          <Route path="scan/message" element={<MessageScanner />} />
          <Route path="scan/document" element={<DocumentScanner />} />
          <Route path="history" element={<ScanHistory />} />
          <Route path="review" element={<ReviewQueue />} />
          <Route path="scans/:scanId" element={<ScanDetails />} />

          {/* Admin-only */}
          <Route element={<AdminRoute />}>
            <Route path="admin" element={<AdminDashboard />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
