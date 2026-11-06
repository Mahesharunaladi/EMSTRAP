import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [pendingVerification, setPendingVerification] = useState(() => { try { return JSON.parse(sessionStorage.getItem('emstrap_pending_verification')) || null } catch { return null } })
  const [loading, setLoading] = useState(true)
  useEffect(() => { api.get('/auth/me').then(({ data }) => setUser(data.data.user)).catch(() => setUser(null)).finally(() => setLoading(false)) }, [])
  const signIn = async (email, password) => { const { data } = await api.post('/auth/login', { email, password }); setUser(data.data.user); return data }
  const startSignUp = async (name, email, password) => { const { data } = await api.post('/auth/register', { name, email, password }); const pending = { name, email }; sessionStorage.setItem('emstrap_pending_verification', JSON.stringify(pending)); setPendingVerification(pending); return data }
  const verifyEmail = async code => { if (!pendingVerification) throw new Error('Verification session expired'); const { data } = await api.post('/auth/verify-email', { email: pendingVerification.email, code }); setUser(data.data.user); sessionStorage.removeItem('emstrap_pending_verification'); setPendingVerification(null); return data }
  const resendCode = async () => { if (!pendingVerification) return; return api.post('/auth/resend-verification', { email: pendingVerification.email }) }
  const signOut = async () => { try { await api.post('/auth/logout') } finally { setUser(null) } }
  const value = useMemo(() => ({ user, isAuthenticated: Boolean(user), loading, pendingVerification, signIn, startSignUp, verifyEmail, resendCode, signOut }), [user, loading, pendingVerification])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
