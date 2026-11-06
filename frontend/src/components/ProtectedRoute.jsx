import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ allowedRoles }) {
  const { user, isAuthenticated, loading } = useAuth()
  if (loading) return <div className="grid min-h-screen place-items-center bg-[#f7f7f5] text-sm font-semibold text-slate-500">Loading your secure session…</div>
  if (!isAuthenticated) return <Navigate to="/signin" replace />
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to={`/dashboard/${user.role}`} replace />
  return <Outlet />
}
