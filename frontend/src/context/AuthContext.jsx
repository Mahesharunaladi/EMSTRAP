import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [pendingVerification, setPendingVerification] = useState(() => { try { return JSON.parse(sessionStorage.getItem('emstrap_pending_verification')) || null } catch { return null } })
  const [loading, setLoading] = useState(true)
  const [locationStatus, setLocationStatus] = useState('starting')
  const [currentLocation, setCurrentLocation] = useState(null)
  const [locationRetry, setLocationRetry] = useState(0)
  const latestPosition = useRef(null)
  const lastLocationSyncAt = useRef(0)
  useEffect(() => { api.get('/auth/me').then(({ data }) => setUser(data.data.user)).catch(() => setUser(null)).finally(() => setLoading(false)) }, [])
  useEffect(() => {
    if (!user) { setLocationStatus('signed-out'); latestPosition.current = null; return undefined }
    if (!window.isSecureContext) { setLocationStatus('insecure-context'); return undefined }
    if (!navigator.geolocation) { setLocationStatus('unsupported'); return undefined }
    let active = true; let watchId
    lastLocationSyncAt.current = 0
    setLocationStatus('starting')

    const syncLocation = async (location) => {
      const now = Date.now()
      if (now - lastLocationSyncAt.current < 5000) return
      lastLocationSyncAt.current = now
      try {
        const { data } = await api.patch('/auth/location', location)
        if (!active) return
        setUser(current => current ? { ...current, currentLocation: data.data.location } : current)
        setLocationStatus('live')
      } catch { if (active) setLocationStatus('sync-error') }
    }

    const useNetworkFallback = async () => {
      if (!active) return
      setLocationStatus('fallback')
      try {
        let lat, lng
        try {
          const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(3000) })
          if (res.ok) { const d = await res.json(); lat = Number(d.latitude); lng = Number(d.longitude) }
        } catch (_) {}
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          try {
            const res2 = await fetch('https://ipwho.is/', { signal: AbortSignal.timeout(3000) })
            if (res2.ok) { const d2 = await res2.json(); lat = Number(d2.latitude); lng = Number(d2.longitude) }
          } catch (_) {}
        }
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          const location = { lat, lng, source: 'network-approximation' }
          latestPosition.current = location
          setCurrentLocation(location)
          setLocationStatus('approximate')
          await syncLocation(location)
          return
        }
      } catch { if (active) setLocationStatus('unavailable') }
    }

    const startTracking = (highAccuracy = false) => {
      if (!active) return
      if (watchId) navigator.geolocation.clearWatch(watchId)
      watchId = navigator.geolocation.watchPosition(
        async ({ coords }) => {
          const location = { lat: coords.latitude, lng: coords.longitude, source: 'browser-gps' }
          latestPosition.current = location
          setCurrentLocation(location)
          setLocationStatus('located')
          await syncLocation(location)
        },
        error => {
          if (!active) return
          if (error.code === 1) {
            setLocationStatus('permission')
            useNetworkFallback()
          } else if (highAccuracy) {
            startTracking(false)
          } else {
            useNetworkFallback()
          }
        },
        { enableHighAccuracy: highAccuracy, maximumAge: 30000, timeout: 15000 }
      )
    }

    startTracking(false)
    return () => { active = false; if (watchId) navigator.geolocation.clearWatch(watchId); latestPosition.current = null }
  }, [user?.id, locationRetry])
  const signIn = async (email, password) => { const { data } = await api.post('/auth/login', { email, password }); setUser(data.data.user); return data }
  const startSignUp = async (name, email, password) => { const { data } = await api.post('/auth/register', { name, email, password }); const pending = { name, email }; sessionStorage.setItem('emstrap_pending_verification', JSON.stringify(pending)); setPendingVerification(pending); return data }
  const verifyEmail = async code => { if (!pendingVerification) throw new Error('Verification session expired'); const { data } = await api.post('/auth/verify-email', { email: pendingVerification.email, code }); setUser(data.data.user); sessionStorage.removeItem('emstrap_pending_verification'); setPendingVerification(null); return data }
  const resendCode = async () => { if (!pendingVerification) return; return api.post('/auth/resend-verification', { email: pendingVerification.email }) }
  const signOut = async () => { try { await api.post('/auth/logout') } finally { setUser(null) } }
  const updateProfile = async updates => { const { data } = await api.patch('/auth/profile', updates); setUser(data.data.user); return data.data.user }
  const getHistory = async type => { const { data } = await api.get(`/auth/${type === 'billing' ? 'billing-history' : 'ride-history'}`); return data.data[type === 'billing' ? 'payments' : 'rides'] }
  const retryLocation = () => setLocationRetry(value => value + 1)
  const value = useMemo(() => ({ user, isAuthenticated: Boolean(user), loading, pendingVerification, locationStatus, currentLocation, retryLocation, signIn, startSignUp, verifyEmail, resendCode, signOut, updateProfile, getHistory }), [user, loading, pendingVerification, locationStatus, currentLocation])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
