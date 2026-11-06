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
import SignInPage from './pages/auth/SignInPage'
import SignUpPage from './pages/auth/SignUpPage'
import VerifyEmailPage from './pages/auth/VerifyEmailPage'

function PublicRoute({ children }) {
  return children
}

export default function App() {
  return <BrowserRouter><AuthProvider><Routes>
    <Route path="/" element={<Navigate to="/signin" replace />} />
    <Route path="/signin" element={<PublicRoute><SignInPage /></PublicRoute>} />
    <Route path="/signup" element={<PublicRoute><SignUpPage /></PublicRoute>} />
    <Route path="/verify-email" element={<PublicRoute><VerifyEmailPage /></PublicRoute>} />
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
      <Route path="/booking" element={<BookingPage />} />
    </Route>
    <Route element={<ProtectedRoute allowedRoles={['driver']} />}><Route path="/dashboard/driver" element={<RolePlaceholder role="Driver" />} /></Route>
    <Route element={<ProtectedRoute allowedRoles={['police']} />}><Route path="/dashboard/police" element={<RolePlaceholder role="Police Command" />} /></Route>
    <Route element={<ProtectedRoute allowedRoles={['hospital']} />}><Route path="/dashboard/hospital" element={<RolePlaceholder role="Hospital" />} /></Route>
    <Route element={<ProtectedRoute allowedRoles={['admin']} />}><Route path="/dashboard/admin" element={<RolePlaceholder role="Admin" />} /></Route>
    <Route path="*" element={<Navigate to="/signin" replace />} />
  </Routes></AuthProvider></BrowserRouter>
}
