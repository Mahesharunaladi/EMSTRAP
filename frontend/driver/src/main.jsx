import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import DriverDashboard from '../../src/pages/driver/DriverDashboard'
import DriverPortal from '../../src/pages/driver/DriverPortal'
import DriverProfile from '../../src/pages/driver/DriverProfile'
import './driver.css'

function DriverRoute({ children }) {
  return sessionStorage.getItem('emstrap_driver_session') ? children : <Navigate to="/driver" replace />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/driver" replace />} />
        <Route path="/driver" element={<DriverPortal />} />
        <Route path="/dashboard/driver" element={<Navigate to="/driver/dashboard" replace />} />
        <Route path="/driver/dashboard" element={<DriverRoute><DriverDashboard /></DriverRoute>} />
        <Route path="/driver/profile" element={<DriverRoute><DriverProfile /></DriverRoute>} />
        <Route path="*" element={<Navigate to="/driver" replace />} />
      </Routes>
    </BrowserRouter>
    <Toaster position="top-center" toastOptions={{ style: { background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155' } }} />
  </StrictMode>,
)
