import { Ambulance, Bell, BellOff, Camera, Check, CircleAlert, Eye, LocateFixed, Lock, MapPin, Radio, ShieldCheck, Siren, User, Volume2, VolumeX, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import api from './services/api'
import { joinPoliceRoom } from './services/emergencySocket'
import { normalizeCoords } from './utils/geoUtils'
import { calculateEta } from './utils/etaCalculator'
import { playEmergencySiren, stopEmergencySiren } from './utils/audioPlayer'

function relativeMarkerStyles(userLocation, driverLocation) {
  const u = normalizeCoords(userLocation)
  const d = normalizeCoords(driverLocation)
  const points = [u, d].filter(Boolean)
  if (points.length < 2) return { user: { left: '50%', top: '50%', right: 'auto' }, driver: { left: '70%', top: '58%', right: 'auto' } }
  const latitudes = points.map(point => Number(point.lat))
  const longitudes = points.map(point => Number(point.lng))
  const minLat = Math.min(...latitudes); const maxLat = Math.max(...latitudes)
  const minLng = Math.min(...longitudes); const maxLng = Math.max(...longitudes)
  const latSpan = Math.max(maxLat - minLat, 0.001); const lngSpan = Math.max(maxLng - minLng, 0.001)
  const place = point => ({ left: `${15 + ((Number(point.lng) - minLng) / lngSpan) * 70}%`, top: `${15 + ((maxLat - Number(point.lat)) / latSpan) * 70}%`, right: 'auto' })
  return { user: place(u), driver: place(d) }
}

export default function PoliceDashboard() {
  const [emergencies, setEmergencies] = useState([])
  const [locations, setLocations] = useState({})
  const [assignments, setAssignments] = useState({})
  const [station, setStation] = useState(null)
  const [modalImage, setModalImage] = useState(null)
  const [alarmActive, setAlarmActive] = useState(false)

  // Hardcoded Police Login state (for standalone web app & shared session)
  const [authenticated, setAuthenticated] = useState(() => {
    return localStorage.getItem('emstrap_police_session') === 'true' ||
           sessionStorage.getItem('emstrap_police_session') === 'true'
  })
  const [loginEmail, setLoginEmail] = useState('police.hq@emstrap.gov.in')
  const [loginPassword, setLoginPassword] = useState('Police@123')
  const [loginError, setLoginError] = useState('')

  const handlePoliceLogin = (e) => {
    e.preventDefault()
    const emailNorm = loginEmail.trim().toLowerCase()
    if (
      (emailNorm === 'police.hq@emstrap.gov.in' || emailNorm === 'police01' || emailNorm === 'police' || emailNorm === 'yelahanka.ps@emstrap.gov.in') &&
      loginPassword === 'Police@123'
    ) {
      localStorage.setItem('emstrap_police_session', 'true')
      setAuthenticated(true)
      setLoginError('')
      toast.success('Authenticated into Police Command Center')
      // Request browser notification permission
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission()
      }
    } else {
      setLoginError('Invalid police credentials. Use police.hq@emstrap.gov.in / Police@123')
    }
  }

  const fillDemoCredentials = (email = 'police.hq@emstrap.gov.in') => {
    setLoginEmail(email)
    setLoginPassword('Police@123')
    toast.success(`Filled credentials for ${email}`)
  }

  const handlePoliceLogout = () => {
    localStorage.removeItem('emstrap_police_session')
    sessionStorage.removeItem('emstrap_police_session')
    stopEmergencySiren()
    setAlarmActive(false)
    setAuthenticated(false)
  }

  const triggerBuzzerAlarm = (alertData) => {
    setAlarmActive(true)
    playEmergencySiren(true) // Loop siren
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('🚨 CRITICAL EMERGENCY SOS ALERT', {
          body: `Emergency reported at ${alertData.location?.lat?.toFixed(4)}, ${alertData.location?.lng?.toFixed(4)}. Units dispatched.`,
          icon: '/emstrap-logo.png',
          tag: 'emergency-sos'
        })
      } catch (_) {}
    }
  }

  const muteAlarm = () => {
    stopEmergencySiren()
    setAlarmActive(false)
    toast.success('Emergency siren muted / acknowledged')
  }

  useEffect(() => {
    if (!authenticated) return

    let active = true

    // Load initial emergencies from both live-tracking and alerts history
    const loadInitialAlerts = () => {
      api.get('/police/live-tracking').then(({ data }) => {
        if (!active) return
        const items = data?.data?.emergencies || []
        if (items.length) {
          setEmergencies(items)
          setLocations(Object.fromEntries(items.map(item => [item._id, item.driverLocation]).filter(([, location]) => location)))
        }
      }).catch(() => {})

      api.get('/police/alerts').then(({ data }) => {
        if (!active) return
        const alertsList = data?.data?.alerts || data?.data?.emergencies || []
        if (alertsList.length) {
          setEmergencies(current => {
            const map = new Map(current.map(item => [String(item._id || item.emergencyId), item]))
            for (const item of alertsList) {
              const id = String(item._id || item.emergencyId)
              if (!map.has(id)) {
                map.set(id, item)
              }
            }
            return Array.from(map.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          })
        }
      }).catch(() => {})
    }

    loadInitialAlerts()

    const onEvidenceUpdated = updatePayload => {
      const targetId = String(updatePayload.emergencyId || updatePayload._id)
      setEmergencies(current =>
        current.map(item => {
          if (String(item._id || item.emergencyId) === targetId) {
            return {
              ...item,
              evidenceImages: updatePayload.evidenceImages || item.evidenceImages || [],
              incidentDetails: updatePayload.incidentDetails || item.incidentDetails
            }
          }
          return item
        })
      )
    }

    const cleanup = joinPoliceRoom(
      alert => {
        const alertId = String(alert.emergencyId || alert._id)
        setEmergencies(current => {
          if (current.some(item => String(item._id || item.emergencyId) === alertId)) {
            return current.map(item => String(item._id || item.emergencyId) === alertId ? { ...item, ...alert } : item)
          }
          return [
            {
              _id: alertId,
              emergencyId: alertId,
              location: alert.location,
              status: alert.status || 'PENDING',
              userId: alert.userId,
              incidentImage: alert.incidentImage,
              evidenceImages: alert.evidenceImages || (alert.incidentImage ? [alert.incidentImage] : []),
              incidentDetails: alert.incidentDetails,
              createdAt: alert.createdAt || new Date()
            },
            ...current
          ]
        })
        if (!alert.silentSync) {
          triggerBuzzerAlarm(alert)
          toast.success(`🚨 CRITICAL: New Emergency Alert · ${alertId.slice(-6)}`)
        }
      },
      assignment => setAssignments(current => ({ ...current, [assignment.emergencyId]: assignment.driver })),
      update => setLocations(current => ({ ...current, [update.emergencyId]: update.location })),
      update => setEmergencies(current => current.map(item => String(item._id) === String(update.emergencyId) ? { ...item, location: update.location } : item)),
      onEvidenceUpdated
    )

    return () => { active = false; cleanup(); stopEmergencySiren() }
  }, [authenticated])

  // 10-second background REST polling fallback
  useEffect(() => {
    if (!authenticated) return
    let active = true
    const pollAlerts = () => {
      api.get('/police/live-tracking').then(({ data }) => {
        if (!active) return
        const items = data?.data?.emergencies || []
        if (items.length) {
          setEmergencies(current => {
            const knownIds = new Set(current.map(item => String(item._id || item.emergencyId)))
            let hasNewAlert = false
            for (const em of items) {
              const id = String(em._id || em.emergencyId)
              if (!knownIds.has(id)) {
                hasNewAlert = true
                break
              }
            }
            if (hasNewAlert && current.length > 0) {
              triggerBuzzerAlarm(items[0])
              toast.success(`🚨 Emergency SOS Alert Updated!`)
            }
            return items
          })
          setLocations(Object.fromEntries(items.map(item => [item._id, item.driverLocation || item.assignedDriverId?.currentLocation]).filter(([, location]) => location)))
        }
      }).catch(() => {})
    }

    const timer = window.setInterval(pollAlerts, 10000)
    return () => { active = false; window.clearInterval(timer) }
  }, [authenticated])

  useEffect(() => {
    const emergency = emergencies[0]
    if (!emergency?.location) return
    api.get(`/police/nearest-station?lat=${emergency.location.lat}&lng=${emergency.location.lng}`)
      .then(({ data }) => setStation(data.data.station))
      .catch(() => {})
  }, [emergencies[0]?.location?.lat, emergencies[0]?.location?.lng])

  // Login Screen if not authenticated
  if (!authenticated) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-950 p-4 text-white">
        <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
          <div className="text-center">
            <img src="/emstrap-logo.png" alt="EmSTraP" className="mx-auto h-14 w-auto" />
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-blue-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-400">
              <ShieldCheck size={14} /> Police Command System
            </div>
            <h1 className="mt-2 font-display text-2xl font-bold">Officer Authorization</h1>
            <p className="mt-1 text-xs text-slate-400">State Police Emergency Response Dispatch Terminal</p>
          </div>

          <form onSubmit={handlePoliceLogin} className="mt-6 space-y-4">
            {loginError && (
              <div className="rounded-xl bg-red-500/20 p-3 text-xs font-bold text-red-300 border border-red-500/30">
                {loginError}
              </div>
            )}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Badge ID / Official Email
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  placeholder="police.hq@emstrap.gov.in"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
              />
            </div>

            <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 text-[11px] text-blue-300">
              <span className="font-bold">Demo Police Credentials:</span>
              <p className="mt-0.5 font-mono text-slate-300">Badge/Email: <strong className="text-white">police.hq@emstrap.gov.in</strong> (or <strong className="text-white">yelahanka.ps@emstrap.gov.in</strong>)</p>
              <p className="font-mono text-slate-300">Password: <strong className="text-white">Police@123</strong></p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => fillDemoCredentials('police.hq@emstrap.gov.in')}
                  className="rounded-lg bg-blue-600/30 px-2.5 py-1 text-[11px] font-bold text-blue-200 border border-blue-400/40 hover:bg-blue-600/50"
                >
                  ⚡ Fill HQ Demo Login
                </button>
                <button
                  type="button"
                  onClick={() => fillDemoCredentials('yelahanka.ps@emstrap.gov.in')}
                  className="rounded-lg bg-blue-600/30 px-2.5 py-1 text-[11px] font-bold text-blue-200 border border-blue-400/40 hover:bg-blue-600/50"
                >
                  ⚡ Fill Yelahanka PS Demo Login
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 transition"
            >
              Sign In to Command Center
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-[#f7f7f5] px-4 py-6 text-slate-950">
      <div className="mx-auto w-full max-w-[840px]">
        {/* Header with Mute & Logout */}
        <header className="flex items-center justify-between border-b border-slate-200 pb-5">
          <div>
            <div className="flex items-center gap-3">
              <img src="/emstrap-logo.png" alt="EmSTraP" className="h-12 w-auto" />
              <div className="flex items-center gap-1.5">
                <span className="rounded-full bg-blue-900 px-3 py-1 text-xs font-bold text-white shadow-sm flex items-center gap-1">
                  <ShieldCheck size={14} className="text-blue-300" /> Police Command HQ
                </span>
                <a
                  href="/app"
                  title="Open Citizen Portal"
                  className="rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-800 transition hover:bg-slate-300"
                >
                  Citizen
                </a>
                <a
                  href="/driver"
                  title="Open Driver Portal"
                  className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-slate-800"
                >
                  Driver
                </a>
              </div>
            </div>
            <p className="mt-2 text-xs font-bold uppercase tracking-[.2em] text-slate-500">
              State Police Radar & Incident Command
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {alarmActive ? (
              <button
                onClick={muteAlarm}
                className="flex items-center gap-1.5 rounded-full bg-red-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-lg shadow-red-600/30 animate-bounce hover:bg-red-700"
              >
                <VolumeX size={15} /> Mute Alarm
              </button>
            ) : (
              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Live Monitoring
              </span>
            )}
            <button
              onClick={handlePoliceLogout}
              className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100"
            >
              Sign Out
            </button>
          </div>
        </header>

        {/* Active Emergency Buzzer Alert Bar */}
        {alarmActive && (
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-red-600 p-4 text-white shadow-xl shadow-red-600/30">
            <div className="flex items-center gap-3">
              <Siren size={24} className="animate-spin" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-red-100">Live Siren Alarm Triggered</p>
                <h3 className="font-display text-base font-bold">New incoming Emergency SOS report!</h3>
              </div>
            </div>
            <button
              onClick={muteAlarm}
              className="rounded-xl bg-white px-4 py-2 text-xs font-black text-red-600 shadow hover:bg-red-50"
            >
              Acknowledge & Mute
            </button>
          </div>
        )}

        <div className="mt-6 grid gap-6 md:grid-cols-[2fr_1fr]">
          {emergencies.length ? (
            <section className="space-y-4">
              {emergencies.map(emergency => {
                const driver = assignments[emergency._id] || emergency.assignedDriverId
                const driverLocation = normalizeCoords(locations[emergency._id] || emergency.driverLocation || driver?.currentLocation)
                const victimLocation = normalizeCoords(emergency.location)
                const markerStyles = relativeMarkerStyles(victimLocation, driverLocation)
                const isAccepted = emergency.status === 'ACCEPTED' || emergency.status === 'ARRIVED'

                const eta = (driverLocation && victimLocation && isAccepted)
                  ? calculateEta(driverLocation, victimLocation, 45)
                  : null

                const evidenceItems = emergency.evidenceImages || emergency.evidence || []

                return (
                  <article key={emergency._id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${isAccepted ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                            {emergency.status}
                          </span>
                          <span className="text-xs font-semibold text-slate-400">Incident #{String(emergency._id).slice(-6)}</span>
                        </div>
                        <h2 className="mt-1 font-display text-base font-bold">
                          {isAccepted ? 'Government Ambulance Dispatched' : 'Immediate Police Response Required'}
                        </h2>
                      </div>
                      <span className="grid h-10 w-10 place-items-center rounded-2xl bg-red-100 text-red-600">
                        <Siren size={20} className={isAccepted ? '' : 'animate-pulse'} />
                      </span>
                    </div>

                    {/* Live ETA Badge */}
                    {eta && (
                      <div className="flex items-center justify-between rounded-xl bg-amber-500/15 p-2.5 border border-amber-300">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                          <span className="text-xs font-bold text-amber-950">Ambulance ETA: {eta.badgeText}</span>
                        </div>
                        <span className="rounded-lg bg-amber-500 px-2 py-0.5 text-[10px] font-black text-white">
                          {eta.text}
                        </span>
                      </div>
                    )}

                    {/* Dual Interactive Radar */}
                    {driverLocation ? (
                      <div className="overflow-hidden rounded-2xl border border-slate-300 bg-slate-100 shadow-inner">
                        <iframe
                          title="Police Dual Tracking Radar"
                          className="h-52 w-full border-0"
                          loading="lazy"
                          src={`https://www.openstreetmap.org/export/embed.html?bbox=${driverLocation.lng - 0.012}%2C${driverLocation.lat - 0.012}%2C${driverLocation.lng + 0.012}%2C${driverLocation.lat + 0.012}&layer=mapnik&marker=${driverLocation.lat}%2C${driverLocation.lng}`}
                        />
                      </div>
                    ) : victimLocation ? (
                      <div className="overflow-hidden rounded-2xl border border-slate-300 bg-slate-100 shadow-inner">
                        <iframe
                          title="Police Incident Location Radar"
                          className="h-52 w-full border-0"
                          loading="lazy"
                          src={`https://www.openstreetmap.org/export/embed.html?bbox=${victimLocation.lng - 0.008}%2C${victimLocation.lat - 0.008}%2C${victimLocation.lng + 0.008}%2C${victimLocation.lat + 0.008}&layer=mapnik&marker=${victimLocation.lat}%2C${victimLocation.lng}`}
                        />
                      </div>
                    ) : (
                      <div className="driver-map h-48"><div className="driver-map-grid" /><span className="driver-marker driver-marker-user"><MapPin size={16} fill="currentColor" /></span></div>
                    )}

                    {/* Coordinates & Caller Info */}
                    <div className="rounded-2xl bg-slate-50 p-3 text-xs text-slate-700 space-y-1">
                      <p><b>Victim GPS:</b> {victimLocation ? `${victimLocation.lat.toFixed(5)}, ${victimLocation.lng.toFixed(5)}` : 'Pending GPS'}</p>
                      {emergency.userId?.name && <p><b>Caller:</b> {emergency.userId.name} {emergency.userId.phone ? `(${emergency.userId.phone})` : ''}</p>}
                      {emergency.incidentDetails && <p><b>Incident Notes:</b> {emergency.incidentDetails}</p>}
                    </div>

                    {/* Scene Evidence Gallery */}
                    {(emergency.incidentImage?.url || evidenceItems.length > 0) && (
                      <div className="space-y-2">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Incident Scene Evidence</p>
                        <div className="flex flex-wrap gap-2">
                          {emergency.incidentImage?.url && (
                            <img
                              src={emergency.incidentImage.url}
                              alt="Scene evidence"
                              onClick={() => setModalImage(emergency.incidentImage.url)}
                              className="h-16 w-16 cursor-pointer rounded-xl object-cover border-2 border-slate-300 hover:opacity-90"
                            />
                          )}
                          {evidenceItems.map((item, idx) => {
                            const url = typeof item === 'string' ? item : item?.url
                            if (!url) return null
                            return (
                              <img
                                key={idx}
                                src={url}
                                alt={`Evidence ${idx + 1}`}
                                onClick={() => setModalImage(url)}
                                className="h-16 w-16 cursor-pointer rounded-xl object-cover border-2 border-slate-300 hover:opacity-90"
                              />
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Driver Response Info */}
                    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                      <div className="flex items-center gap-2.5">
                        <div className="grid h-10 w-10 place-items-center rounded-xl bg-red-600 text-white">
                          <Ambulance size={18} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">{driver?.name || 'Awaiting Driver Assignment'}</p>
                          <p className="text-[10px] text-slate-500">{driver?.phone ? `Phone: ${driver.phone}` : 'Government Emergency Unit'}</p>
                        </div>
                      </div>
                      {driverLocation && (
                        <a
                          href={`https://www.google.com/maps?q=${driverLocation.lat},${driverLocation.lng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg bg-emerald-700 px-2.5 py-1 text-[11px] font-bold text-white shadow"
                        >
                          Google Maps
                        </a>
                      )}
                    </div>
                  </article>
                )
              })}
            </section>
          ) : (
            <section className="rounded-3xl border border-slate-200 bg-white p-8 text-center">
              <ShieldCheck className="mx-auto text-emerald-600" size={32} />
              <h2 className="mt-4 font-display text-xl font-bold">No active emergencies</h2>
              <p className="mt-2 text-sm text-slate-500">This command channel will show victim and ambulance locations when an SOS is active.</p>
            </section>
          )}

          <aside className="space-y-4">
            <div className="rounded-3xl bg-slate-950 p-5 text-white">
              <div className="flex items-start gap-3">
                <CircleAlert className="text-red-400" size={20} />
                <div>
                  <h2 className="text-sm font-bold">Police Response Channel</h2>
                  <p className="mt-2 text-xs leading-5 text-slate-300">
                    High-priority real-time dispatch feed. Dual GPS tracking and scene photos are logged automatically.
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Nearest Command Station</p>
              <p className="mt-2 text-sm font-bold">{station?.stationName || station?.name || 'Central Command Station'}</p>
              <p className="mt-1 text-xs text-slate-500">{station ? `${station.distanceKm.toFixed(1)} km from incident` : 'Connected to state police grid'}</p>
            </div>
          </aside>
        </div>
      </div>

      {/* Enlarged Photo Modal */}
      {modalImage && (
        <div
          role="dialog"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setModalImage(null)}
        >
          <div className="relative max-h-[90vh] max-w-3xl overflow-hidden rounded-2xl bg-slate-950 p-2" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setModalImage(null)}
              className="absolute right-3 top-3 z-10 rounded-full bg-white/20 p-1.5 text-white hover:bg-white/30"
            >
              <X size={18} />
            </button>
            <img src={modalImage} alt="Scene evidence" className="max-h-[80vh] w-auto rounded-xl object-contain mx-auto" />
          </div>
        </div>
      )}
    </main>
  )
}
