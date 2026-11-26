import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import BookingPage from './pages/BookingPage'
import MobileHomePage from './pages/mobile/MobileHomePage'
import MobileServicesPage from './pages/mobile/MobileServicesPage'
import MobileActivityPage from './pages/mobile/MobileActivityPage'
import MobileAccountPage from './pages/mobile/MobileAccountPage'
import AccountSubPage from './pages/mobile/AccountSubPage'
import AccountHistoryPage from './pages/mobile/AccountHistoryPage'
import SignInPage from './pages/auth/SignInPage'
import SignUpPage from './pages/auth/SignUpPage'
import VerifyEmailPage from './pages/auth/VerifyEmailPage'
import DriverPortal from './pages/driver/DriverPortal'
import DriverDashboard from './pages/driver/DriverDashboard'
import DriverProfile from './pages/driver/DriverProfile'
import PoliceDashboard from './pages/police/PoliceDashboard'
import ActiveEmergencyPage from './pages/emergency/ActiveEmergencyPage'
import ActiveBookingPage from './pages/booking/ActiveBookingPage'

function RootRedirect() {
  const { user, loading, isAuthInitializing } = useAuth()
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 3500)
    return () => clearTimeout(t)
  }, [])

  if ((isAuthInitializing || loading) && !user && !timedOut) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f7f7f5] text-sm font-semibold text-slate-500">
        <div className="flex flex-col items-center gap-3">
          <img src="/emstrap-logo.png" alt="EmSTraP" className="h-12 w-auto animate-pulse" />
          <p>Connecting to secure network…</p>
        </div>
      </div>
    )
  }
  return user ? <Navigate to="/app" replace /> : <Navigate to="/signin" replace />
}

function PublicRoute({ children }) {
  const { user, loading, isAuthInitializing } = useAuth()
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 3500)
    return () => clearTimeout(t)
  }, [])

  if ((isAuthInitializing || loading) && !user && !timedOut) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f7f7f5] text-sm font-semibold text-slate-500">
        <div className="flex flex-col items-center gap-3">
          <img src="/emstrap-logo.png" alt="EmSTraP" className="h-12 w-auto animate-pulse" />
          <p>Connecting to secure network…</p>
        </div>
      </div>
    )
  }
  return user ? <Navigate to="/app" replace /> : children
}

function DriverRoute({ children }) {
  const { driverSession, isAuthInitializing } = useAuth()
  if (isAuthInitializing) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f7f7f5] text-sm font-semibold text-slate-500">
        <div className="flex flex-col items-center gap-3">
          <img src="/emstrap-logo.png" alt="EmSTraP" className="h-12 w-auto animate-pulse" />
          <p>Restoring driver session…</p>
        </div>
      </div>
    )
  }
  const hasSession = Boolean(driverSession?.token || localStorage.getItem('emstrap_driver_token') || sessionStorage.getItem('emstrap_driver_session'))
  return hasSession ? children : <Navigate to="/driver/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/signin" element={<PublicRoute><SignInPage /></PublicRoute>} />
          <Route path="/signup" element={<PublicRoute><SignUpPage /></PublicRoute>} />
          <Route path="/verify-email" element={<PublicRoute><VerifyEmailPage /></PublicRoute>} />

          {/* User Portal Routes */}
          <Route element={<ProtectedRoute allowedRoles={['user']} />}>
            <Route path="/dashboard/user" element={<MobileHomePage />} />
            <Route path="/app" element={<MobileHomePage />} />
            <Route path="/app/services" element={<MobileServicesPage />} />
            <Route path="/app/activity" element={<MobileActivityPage />} />
            <Route path="/app/account" element={<MobileAccountPage />} />
            <Route path="/app/account/details" element={<AccountSubPage section="details" />} />
            <Route path="/app/account/locations" element={<AccountSubPage section="locations" />} />
            <Route path="/app/account/payments" element={<AccountSubPage section="payments" />} />
            <Route path="/app/account/safety" element={<AccountSubPage section="safety" />} />
            <Route path="/app/account/billing" element={<AccountHistoryPage type="billing" />} />
            <Route path="/app/account/rides" element={<AccountHistoryPage type="rides" />} />
            <Route path="/booking" element={<BookingPage />} />
            <Route path="/emergency/active/:emergencyId" element={<ActiveEmergencyPage />} />
            <Route path="/booking/active/:bookingId" element={<ActiveBookingPage />} />
          </Route>

          {/* Driver Portal Routes */}
          <Route path="/driver" element={<DriverPortal />} />
          <Route path="/driver/login" element={<DriverPortal />} />
          <Route path="/dashboard/driver" element={<Navigate to="/driver/dashboard" replace />} />
          <Route path="/driver/dashboard" element={<DriverRoute><DriverDashboard /></DriverRoute>} />
          <Route path="/driver/profile" element={<DriverRoute><DriverProfile /></DriverRoute>} />

          {/* Police Command Portal Routes */}
          <Route path="/emergency/active/:emergencyId" element={<ActiveEmergencyPage />} />
          <Route path="/booking/active/:bookingId" element={<ActiveBookingPage />} />
          <Route path="/police" element={<PoliceDashboard />} />
          <Route path="/dashboard/police" element={<PoliceDashboard />} />

          <Route path="*" element={<Navigate to="/signin" replace />} />
        </Routes>
      </AuthProvider>
      <Toaster position="top-center" toastOptions={{ style: { background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155' } }} />
    </BrowserRouter>
  )
}
