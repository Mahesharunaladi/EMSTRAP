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
  const locationRequestInFlight = useRef(false)
  useEffect(() => { api.get('/auth/me').then(({ data }) => setUser(data.data.user)).catch(() => setUser(null)).finally(() => setLoading(false)) }, [])
  useEffect(() => {
    if (!user) { setLocationStatus('signed-out'); latestPosition.current = null; return undefined }
    if (!navigator.geolocation) { setLocationStatus('unsupported'); return undefined }
    let active = true; let watchId
    setLocationStatus('starting')
    const sendLocation = async (successStatus = 'live') => {
      if (!active || !latestPosition.current || locationRequestInFlight.current) return
      locationRequestInFlight.current = true
      try { await api.patch('/auth/location', latestPosition.current); if (active) setLocationStatus(successStatus) } catch (error) { if (active) setLocationStatus(error.response?.status === 401 ? 'signed-out' : 'error') } finally { locationRequestInFlight.current = false }
    }
    const useNetworkFallback = async () => {
      if (!active) return
      setLocationStatus('fallback')
      try {
        const response = await fetch('https://ipapi.co/json/')
        const data = await response.json(); const lat = Number(data.latitude); const lng = Number(data.longitude)
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error('No approximate coordinates')
        latestPosition.current = { lat, lng, source: 'network-approximation' }; setCurrentLocation(latestPosition.current); await sendLocation('approximate')
      } catch { if (active) setLocationStatus('unavailable') }
    }
    const handleLocationError = error => { if (!active) return; navigator.geolocation.clearWatch(watchId); if (error.code === 1) setLocationStatus('permission'); else useNetworkFallback() }
    watchId = navigator.geolocation.watchPosition(({ coords }) => { latestPosition.current = { lat: coords.latitude, lng: coords.longitude, source: 'browser-gps' }; setCurrentLocation(latestPosition.current); setLocationStatus('locating'); sendLocation() }, handleLocationError, { enableHighAccuracy: false, maximumAge: 15000, timeout: 10000 })
    const timer = window.setInterval(sendLocation, 5000)
    return () => { active = false; navigator.geolocation.clearWatch(watchId); window.clearInterval(timer); latestPosition.current = null }
  }, [user?.id, locationRetry])
  const signIn = async (email, password) => { const { data } = await api.post('/auth/login', { email, password }); setUser(data.data.user); return data }
  const startSignUp = async (name, email, password) => { const { data } = await api.post('/auth/register', { name, email, password }); const pending = { name, email }; sessionStorage.setItem('emstrap_pending_verification', JSON.stringify(pending)); setPendingVerification(pending); return data }
  const verifyEmail = async code => { if (!pendingVerification) throw new Error('Verification session expired'); const { data } = await api.post('/auth/verify-email', { email: pendingVerification.email, code }); setUser(data.data.user); sessionStorage.removeItem('emstrap_pending_verification'); setPendingVerification(null); return data }
  const resendCode = async () => { if (!pendingVerification) return; return api.post('/auth/resend-verification', { email: pendingVerification.email }) }
  const signOut = async () => { try { await api.post('/auth/logout') } finally { setUser(null) } }
  const retryLocation = () => setLocationRetry(value => value + 1)
  const value = useMemo(() => ({ user, isAuthenticated: Boolean(user), loading, pendingVerification, locationStatus, currentLocation, retryLocation, signIn, startSignUp, verifyEmail, resendCode, signOut }), [user, loading, pendingVerification, locationStatus, currentLocation])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
