import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from '../../src/context/AuthContext'
import DriverDashboard from '../../src/pages/driver/DriverDashboard'
import DriverPortal from '../../src/pages/driver/DriverPortal'
import DriverProfile from '../../src/pages/driver/DriverProfile'
import './driver.css'
import { initSafeGeolocation } from '../../src/utils/safeGeolocation'
import { initPushNotificationChannels } from '../../src/utils/notificationChannels'

initSafeGeolocation()
initPushNotificationChannels()

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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/driver" replace />} />
          <Route path="/driver" element={<DriverPortal />} />
          <Route path="/driver/login" element={<DriverPortal />} />
          <Route path="/dashboard/driver" element={<Navigate to="/driver/dashboard" replace />} />
          <Route path="/driver/dashboard" element={<DriverRoute><DriverDashboard /></DriverRoute>} />
          <Route path="/driver/profile" element={<DriverRoute><DriverProfile /></DriverRoute>} />
          <Route path="*" element={<Navigate to="/driver" replace />} />
        </Routes>
      </AuthProvider>
      <Toaster position="top-center" toastOptions={{ style: { background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155' } }} />
    </BrowserRouter>
  </StrictMode>,
)
