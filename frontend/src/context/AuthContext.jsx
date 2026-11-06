import { createContext, useContext, useMemo, useState } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user] = useState({ id: 'usr_4821', name: 'Alex Morgan', email: 'alex.morgan@email.com', role: 'user', verified: true })
  const value = useMemo(() => ({ user, isAuthenticated: Boolean(user) }), [user])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
