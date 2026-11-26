import { initPushNotificationChannels, syncFcmTokenToServer } from '../utils/notificationChannels'
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import api from '../services/api'
import { getItem, setItem, removeItem, clearAuthSession } from '../utils/persistentStorage'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [driverSession, setDriverSession] = useState(null)
  const [pendingVerification, setPendingVerification] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('emstrap_pending_verification')) || null } catch { return null }
  })
  const [loading, setLoading] = useState(true)
  const [isAuthInitializing, setIsAuthInitializing] = useState(true)
  const [locationStatus, setLocationStatus] = useState('starting')
  const [currentLocation, setCurrentLocation] = useState(null)
  const [locationRetry, setLocationRetry] = useState(0)
  const latestPosition = useRef(null)
  const lastLocationSyncAt = useRef(0)

  // Fast-hydrate from persistent native storage on app boot
  useEffect(() => {
    let active = true

    const bootstrapAuth = async () => {
      try {
        const [
          savedToken,
          savedUserData,
          savedRole,
          savedDriverToken,
          savedDriverData,
          savedOnDuty,
          savedOnDutyLegacy
        ] = await Promise.all([
          getItem('emstrap_token'),
          getItem('emstrap_user_data'),
          getItem('emstrap_role'),
          getItem('emstrap_driver_token'),
          getItem('emstrap_driver_data'),
          getItem('emstrap_driver_on_duty'),
          getItem('emstrap_driver_onduty')
        ])

        if (!active) return

        // Driver Session Persistence Lifecycle:
        // If role is DRIVER (or driver token exists), check ON DUTY status
        const onDutyFlag = savedOnDuty ?? savedOnDutyLegacy
        if (savedRole === 'DRIVER' || savedDriverToken) {
          if (onDutyFlag === 'false') {
            // Driver went OFF DUTY before closing app -> wipe driver session so app routes to /driver/login
            await Promise.all([
              removeItem('emstrap_driver_token'),
              removeItem('emstrap_driver_data')
            ])
            try { sessionStorage.removeItem('emstrap_driver_session') } catch (_) {}
            setDriverSession(null)
          } else if (onDutyFlag === 'true' && savedDriverToken) {
            // Driver was ON DUTY -> hydrate session immediately without requiring login
            try { localStorage.setItem('emstrap_driver_token', savedDriverToken) } catch (_) {}
            try { sessionStorage.setItem('emstrap_driver_session', 'true') } catch (_) {}
            let parsedDriver = null
            try {
              parsedDriver = typeof savedDriverData === 'string' ? JSON.parse(savedDriverData) : savedDriverData
            } catch (_) {}
            setDriverSession({ token: savedDriverToken, driver: parsedDriver, isOnDuty: true })
          }
        }

        if (savedToken && savedUserData) {
          try {
            const parsedUser = typeof savedUserData === 'string' ? JSON.parse(savedUserData) : savedUserData
            if (parsedUser) {
              setUser(parsedUser)
              if (parsedUser.currentLocation?.lat && parsedUser.currentLocation?.lng) {
                setCurrentLocation(parsedUser.currentLocation)
                latestPosition.current = parsedUser.currentLocation
                setLocationStatus('live')
              }
            }
          } catch (_) {}
        }

        // Validate session with backend without clearing session on offline/timeouts
        api.get('/auth/me')
          .then(async ({ data }) => {
            if (!active) return
            const currentUser = data.data.user
            setUser(currentUser)
            await setItem('emstrap_user_data', JSON.stringify(currentUser))
            if (currentUser?.currentLocation?.lat && currentUser?.currentLocation?.lng) {
              setCurrentLocation(currentUser.currentLocation)
              latestPosition.current = currentUser.currentLocation
              setLocationStatus('live')
            }
          })
          .catch(async (err) => {
            // Only clear storage if explicitly 401 Unauthorized (e.g. invalid/revoked token)
            if (err.response?.status === 401 && err.response?.data?.code === 'INVALID_TOKEN') {
              await clearAuthSession()
              if (active) setUser(null)
            }
          })
          .finally(() => {
            if (active) {
              setLoading(false)
              setIsAuthInitializing(false)
            }
          })
      } catch (e) {
        if (active) {
          setLoading(false)
          setIsAuthInitializing(false)
        }
      }
    }

    bootstrapAuth()
    initPushNotificationChannels().catch(() => {})
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!user) { setLocationStatus('signed-out'); latestPosition.current = null; return undefined }

    if (user?.currentLocation?.lat && user?.currentLocation?.lng) {
      setCurrentLocation(user.currentLocation)
      latestPosition.current = user.currentLocation
      setLocationStatus('live')
      return undefined
    }

    const isCoreLocationBroken = typeof window !== 'undefined' && sessionStorage.getItem('emstrap_corelocation_unavailable') === 'true'
    if (isCoreLocationBroken) {
      setLocationStatus('approximate')
      return undefined
    }

    if (!window.isSecureContext) { setLocationStatus('insecure-context'); return undefined }
    if (!navigator.geolocation) { setLocationStatus('unsupported'); return undefined }

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
          if (error.code === 2) {
            try { sessionStorage.setItem('emstrap_corelocation_unavailable', 'true') } catch (_) {}
          }
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
    const token = data.data?.token
    const currentUser = data.data?.user
    if (token) {
      await setItem('emstrap_token', token)
      await setItem('emstrap_user_token', token)
      await setItem('emstrap_role', 'USER')
    }
    if (currentUser) {
      await setItem('emstrap_user_data', JSON.stringify(currentUser))
      setUser(currentUser)
      if (currentUser?.currentLocation?.lat && currentUser?.currentLocation?.lng) {
        setCurrentLocation(currentUser.currentLocation)
      }
      syncFcmTokenToServer().catch(() => {})
    }
    return data
  }

  const startSignUp = async (name, email, password, phone) => {
    const { data } = await api.post('/auth/register', { name, email, password, phone })
    const pending = { name, email, phone, code: data.data?.otpPreview }
    sessionStorage.setItem('emstrap_pending_verification', JSON.stringify(pending))
    setPendingVerification(pending)
    return data
  }

  const verifyEmail = async code => {
    if (!pendingVerification) throw new Error('Verification session expired')
    const { data } = await api.post('/auth/verify-email', { email: pendingVerification.email, code })
    const token = data.data?.token
    const currentUser = data.data?.user
    if (token) {
      await setItem('emstrap_token', token)
      await setItem('emstrap_user_token', token)
      await setItem('emstrap_role', 'USER')
    }
    if (currentUser) {
      await setItem('emstrap_user_data', JSON.stringify(currentUser))
      setUser(currentUser)
      if (currentUser?.currentLocation?.lat && currentUser?.currentLocation?.lng) {
        setCurrentLocation(currentUser.currentLocation)
      }
      syncFcmTokenToServer().catch(() => {})
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
    await clearAuthSession()
    setUser(null)
    setCurrentLocation(null)
  }

  const updateProfile = async updates => {
    const { data } = await api.patch('/auth/profile', updates)
    setUser(data.data.user)
    await setItem('emstrap_user_data', JSON.stringify(data.data.user))
    return data.data.user
  }

  const getHistory = async type => {
    const { data } = await api.get(`/auth/${type === 'billing' ? 'billing-history' : 'ride-history'}`)
    return data.data[type === 'billing' ? 'payments' : 'rides']
  }

  const saveDriverAuthSession = async (token, driverObj, isOnDuty = true) => {
    await Promise.all([
      setItem('emstrap_driver_token', token),
      setItem('emstrap_driver_data', JSON.stringify(driverObj || {})),
      setItem('emstrap_role', 'DRIVER'),
      setItem('emstrap_driver_on_duty', String(isOnDuty)),
      setItem('emstrap_driver_onduty', String(isOnDuty)),
    ])
    try { sessionStorage.setItem('emstrap_driver_session', 'true') } catch (_) {}
    setDriverSession({ token, driver: driverObj, isOnDuty })
  }

  const clearDriverAuthSession = async () => {
    await Promise.all([
      removeItem('emstrap_driver_token'),
      removeItem('emstrap_driver_data'),
    ])
    try { sessionStorage.removeItem('emstrap_driver_session') } catch (_) {}
    setDriverSession(null)
  }

  const retryLocation = () => {
    try { sessionStorage.removeItem('emstrap_corelocation_unavailable') } catch (_) {}
    setLocationRetry(value => value + 1)
  }

  const value = useMemo(() => ({
    user,
    driverSession,
    saveDriverAuthSession,
    clearDriverAuthSession,
    isAuthenticated: Boolean(user),
    loading,
    isAuthInitializing,
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
  }), [user, driverSession, loading, isAuthInitializing, pendingVerification, locationStatus, currentLocation])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
