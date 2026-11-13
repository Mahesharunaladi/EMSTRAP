export function initSafeGeolocation() {
  if (typeof window === 'undefined') return
  const isMac = typeof navigator !== 'undefined' && (/Macintosh|Mac OS X/i.test(navigator.userAgent) || (navigator.platform && navigator.platform.includes('Mac')))
  if (!isMac) return

  let cachedPosition = null

  const getCachedOrFallback = async () => {
    if (cachedPosition) return cachedPosition
    try {
      const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(2000) })
      if (res.ok) {
        const d = await res.json()
        if (Number.isFinite(d.latitude) && Number.isFinite(d.longitude)) {
          cachedPosition = {
            coords: {
              latitude: Number(d.latitude),
              longitude: Number(d.longitude),
              accuracy: 50,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
            },
            timestamp: Date.now(),
          }
          return cachedPosition
        }
      }
    } catch (_) {}
    cachedPosition = {
      coords: {
        latitude: 12.9716,
        longitude: 77.5946,
        accuracy: 100,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: Date.now(),
    }
    return cachedPosition
  }

  // Pre-fetch coordinates in background
  getCachedOrFallback()

  const geoProto = window.Geolocation?.prototype || (navigator.geolocation ? Object.getPrototypeOf(navigator.geolocation) : null)
  if (geoProto) {
    geoProto.getCurrentPosition = function (success, error) {
      getCachedOrFallback().then(pos => {
        if (typeof success === 'function') success(pos)
      }).catch(err => {
        if (typeof error === 'function') error({ code: 2, message: err?.message || 'Location unavailable' })
      })
    }

    let watchCounter = 1000
    const activeWatches = new Map()

    geoProto.watchPosition = function (success) {
      const id = ++watchCounter
      getCachedOrFallback().then(pos => {
        if (typeof success === 'function') success(pos)
      })
      const timer = setInterval(() => {
        getCachedOrFallback().then(pos => {
          if (typeof success === 'function') success(pos)
        })
      }, 10000)
      activeWatches.set(id, timer)
      return id
    }

    geoProto.clearWatch = function (id) {
      const timer = activeWatches.get(id)
      if (timer) {
        clearInterval(timer)
        activeWatches.delete(id)
      }
    }
  }
}
