import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import BookingPage from './pages/BookingPage'
import RolePlaceholder from './pages/RolePlaceholder'
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

function PublicRoute({ children }) {
  return children
}

function DriverRoute({ children }) {
  return sessionStorage.getItem('emstrap_driver_session') ? children : <Navigate to="/driver" replace />
}

export default function App() {
  return <BrowserRouter><AuthProvider><Routes>
    <Route path="/" element={<Navigate to="/signin" replace />} />
    <Route path="/signin" element={<PublicRoute><SignInPage /></PublicRoute>} />
    <Route path="/signup" element={<PublicRoute><SignUpPage /></PublicRoute>} />
    <Route path="/verify-email" element={<PublicRoute><VerifyEmailPage /></PublicRoute>} />
    <Route path="/driver" element={<DriverPortal />} />
    <Route path="/dashboard/driver" element={<Navigate to="/driver/dashboard" replace />} />
    <Route path="/driver/dashboard" element={<DriverRoute><DriverDashboard /></DriverRoute>} />
    <Route path="/driver/profile" element={<DriverRoute><DriverProfile /></DriverRoute>} />
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
    </Route>
    <Route element={<ProtectedRoute allowedRoles={['driver']} />}><Route path="/dashboard/driver" element={<RolePlaceholder role="Driver" />} /></Route>
    <Route element={<ProtectedRoute allowedRoles={['police']} />}><Route path="/dashboard/police" element={<RolePlaceholder role="Police Command" />} /></Route>
    <Route element={<ProtectedRoute allowedRoles={['hospital']} />}><Route path="/dashboard/hospital" element={<RolePlaceholder role="Hospital" />} /></Route>
    <Route element={<ProtectedRoute allowedRoles={['admin']} />}><Route path="/dashboard/admin" element={<RolePlaceholder role="Admin" />} /></Route>
    <Route path="*" element={<Navigate to="/signin" replace />} />
  </Routes></AuthProvider></BrowserRouter>
}
