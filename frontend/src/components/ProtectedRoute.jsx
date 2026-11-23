import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ allowedRoles = ['user'] }) {
  const { user, loading, isAuthInitializing } = useAuth()

  // Hold off on redirect while checking persistent native storage
  if (isAuthInitializing || (loading && !user)) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f7f7f5] text-sm font-semibold text-slate-500">
        <div className="flex flex-col items-center gap-3">
          <img src="/emstrap-logo.png" alt="EmSTraP" className="h-12 w-auto animate-pulse" />
          <p>Restoring your session…</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/signin" replace />
  }

  const role = (user.role || 'user').toLowerCase()
  const isAllowed = allowedRoles.map(r => r.toLowerCase()).includes(role)

  if (!isAllowed) {
    if (role === 'govt_driver' || role === 'driver') return <Navigate to="/driver/dashboard" replace />
    if (role === 'police') return <Navigate to="/police" replace />
    return <Navigate to="/signin" replace />
  }

  return <Outlet />
}
