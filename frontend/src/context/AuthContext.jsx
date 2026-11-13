import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [pendingVerification, setPendingVerification] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('emstrap_pending_verification')) || null } catch { return null }
  })
  const [loading, setLoading] = useState(true)
  const [locationStatus, setLocationStatus] = useState('starting')
  const [currentLocation, setCurrentLocation] = useState(null)
  const [locationRetry, setLocationRetry] = useState(0)
  const latestPosition = useRef(null)
  const lastLocationSyncAt = useRef(0)

  useEffect(() => {
    api.get('/auth/me')
      .then(({ data }) => {
        const currentUser = data.data.user
        setUser(currentUser)
        if (currentUser?.currentLocation?.lat && currentUser?.currentLocation?.lng) {
          setCurrentLocation(currentUser.currentLocation)
          latestPosition.current = currentUser.currentLocation
          setLocationStatus('live')
        }
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!user) { setLocationStatus('signed-out'); latestPosition.current = null; return undefined }
    if (!window.isSecureContext) { setLocationStatus('insecure-context'); return undefined }
    if (!navigator.geolocation) { setLocationStatus('unsupported'); return undefined }

    // If user has explicitly selected their address, preserve it and do not overwrite with rough network/IP guesses
    if (user?.currentLocation?.source === 'user-selected' && user.currentLocation.lat && user.currentLocation.lng) {
      setCurrentLocation(user.currentLocation)
      latestPosition.current = user.currentLocation
      setLocationStatus('live')
      return undefined
    }

    let active = true
    let watchId = null
    lastLocationSyncAt.current = 0

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
      // If user already has a saved valid location, keep it!
      if (user?.currentLocation?.lat && user?.currentLocation?.lng) {
        setCurrentLocation(user.currentLocation)
        setLocationStatus('live')
        return
      }
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

    const startTracking = () => {
      if (!active) return
      navigator.geolocation.getCurrentPosition(
        async ({ coords }) => {
          if (!active) return
          const location = { lat: coords.latitude, lng: coords.longitude, source: 'browser-gps' }
          latestPosition.current = location
          setCurrentLocation(location)
          setLocationStatus('located')
          await syncLocation(location)

          if (active && !watchId) {
            watchId = navigator.geolocation.watchPosition(
              async ({ coords: moveCoords }) => {
                if (!active) return
                const updated = { lat: moveCoords.latitude, lng: moveCoords.longitude, source: 'browser-gps' }
                latestPosition.current = updated
                setCurrentLocation(updated)
                await syncLocation(updated)
              },
              () => {
                if (watchId) {
                  navigator.geolocation.clearWatch(watchId)
                  watchId = null
                }
              },
              { enableHighAccuracy: false, maximumAge: 30000, timeout: 15000 }
            )
          }
        },
        error => {
          if (!active) return
          if (watchId) {
            navigator.geolocation.clearWatch(watchId)
            watchId = null
          }
          if (error.code === 1) {
            setLocationStatus('permission')
          }
          useNetworkFallback()
        },
        { enableHighAccuracy: false, maximumAge: 30000, timeout: 6000 }
      )
    }

    startTracking()
    return () => { active = false; if (watchId) navigator.geolocation.clearWatch(watchId); latestPosition.current = null }
  }, [user?.id, user?.currentLocation?.source, locationRetry])

  const updateLocation = async (loc) => {
    setCurrentLocation(loc)
    latestPosition.current = loc
    try {
      const { data } = await api.patch('/auth/location', loc)
      if (data?.data?.location) {
        setUser(current => current ? { ...current, currentLocation: data.data.location } : current)
        setCurrentLocation(data.data.location)
        setLocationStatus('live')
        return data.data.location
      }
    } catch (e) {
      console.error('Failed to sync location', e)
    }
  }

  const signIn = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    if (data.data?.token) localStorage.setItem('emstrap_token', data.data.token)
    setUser(data.data.user)
    if (data.data.user?.currentLocation?.lat && data.data.user?.currentLocation?.lng) {
      setCurrentLocation(data.data.user.currentLocation)
    }
    return data
  }

  const startSignUp = async (name, email, password) => {
    const { data } = await api.post('/auth/register', { name, email, password })
    const pending = { name, email, code: data.data?.otpPreview }
    sessionStorage.setItem('emstrap_pending_verification', JSON.stringify(pending))
    setPendingVerification(pending)
    return data
  }

  const verifyEmail = async code => {
    if (!pendingVerification) throw new Error('Verification session expired')
    const { data } = await api.post('/auth/verify-email', { email: pendingVerification.email, code })
    if (data.data?.token) localStorage.setItem('emstrap_token', data.data.token)
    setUser(data.data.user)
    if (data.data.user?.currentLocation?.lat && data.data.user?.currentLocation?.lng) {
      setCurrentLocation(data.data.user.currentLocation)
    }
    sessionStorage.removeItem('emstrap_pending_verification')
    setPendingVerification(null)
    return data
  }

  const resendCode = async () => {
    if (!pendingVerification) return
    const { data } = await api.post('/auth/resend-verification', { email: pendingVerification.email })
    if (data?.data?.otpPreview) {
      const updated = { ...pendingVerification, code: data.data.otpPreview }
      sessionStorage.setItem('emstrap_pending_verification', JSON.stringify(updated))
      setPendingVerification(updated)
    }
    return data
  }

  const signOut = async () => {
    try { await api.post('/auth/logout') } catch (_) {}
    localStorage.removeItem('emstrap_token')
    setUser(null)
    setCurrentLocation(null)
  }

  const updateProfile = async updates => {
    const { data } = await api.patch('/auth/profile', updates)
    setUser(data.data.user)
    return data.data.user
  }

  const getHistory = async type => {
    const { data } = await api.get(`/auth/${type === 'billing' ? 'billing-history' : 'ride-history'}`)
    return data.data[type === 'billing' ? 'payments' : 'rides']
  }

  const retryLocation = () => setLocationRetry(value => value + 1)

  const value = useMemo(() => ({
    user,
    isAuthenticated: Boolean(user),
    loading,
    pendingVerification,
    locationStatus,
    currentLocation,
    retryLocation,
    updateLocation,
    signIn,
    startSignUp,
    verifyEmail,
    resendCode,
    signOut,
    updateProfile,
    getHistory,
  }), [user, loading, pendingVerification, locationStatus, currentLocation])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
