import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import UserDashboard from './pages/dashboards/UserDashboard'
import BookingPage from './pages/BookingPage'
import RolePlaceholder from './pages/RolePlaceholder'

export default function App() {
  return <BrowserRouter><AuthProvider><Routes>
    <Route path="/" element={<Navigate to="/dashboard/user" replace />} />
    <Route element={<ProtectedRoute allowedRoles={['user']} />}>
      <Route path="/dashboard/user" element={<UserDashboard />} />
      <Route path="/booking" element={<BookingPage />} />
    </Route>
    <Route element={<ProtectedRoute allowedRoles={['driver']} />}><Route path="/dashboard/driver" element={<RolePlaceholder role="Driver" />} /></Route>
    <Route element={<ProtectedRoute allowedRoles={['police']} />}><Route path="/dashboard/police" element={<RolePlaceholder role="Police Command" />} /></Route>
    <Route element={<ProtectedRoute allowedRoles={['hospital']} />}><Route path="/dashboard/hospital" element={<RolePlaceholder role="Hospital" />} /></Route>
    <Route element={<ProtectedRoute allowedRoles={['admin']} />}><Route path="/dashboard/admin" element={<RolePlaceholder role="Admin" />} /></Route>
    <Route path="*" element={<Navigate to="/dashboard/user" replace />} />
  </Routes></AuthProvider></BrowserRouter>
}
