import { Ambulance, Camera, CircleAlert, Eye, LocateFixed, MapPin, Radio, ShieldCheck, Siren, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import api from '../../services/api'
import { joinPoliceRoom } from '../../services/emergencySocket'

function relativeMarkerStyles(userLocation, driverLocation) {
  const valid = point => Number.isFinite(Number(point?.lat)) && Number.isFinite(Number(point?.lng))
  const points = [userLocation, driverLocation].filter(valid)
  if (points.length < 2) return { user: { left: '50%', top: '50%', right: 'auto' }, driver: { left: '70%', top: '58%', right: 'auto' } }
  const latitudes = points.map(point => Number(point.lat))
  const longitudes = points.map(point => Number(point.lng))
  const minLat = Math.min(...latitudes); const maxLat = Math.max(...latitudes)
  const minLng = Math.min(...longitudes); const maxLng = Math.max(...longitudes)
  const latSpan = Math.max(maxLat - minLat, 0.001); const lngSpan = Math.max(maxLng - minLng, 0.001)
  const place = point => ({ left: `${15 + ((Number(point.lng) - minLng) / lngSpan) * 70}%`, top: `${15 + ((maxLat - Number(point.lat)) / latSpan) * 70}%`, right: 'auto' })
  return { user: place(userLocation), driver: place(driverLocation) }
}

export default function PoliceDashboard() {
  const [emergencies, setEmergencies] = useState([])
  const [locations, setLocations] = useState({})
  const [assignments, setAssignments] = useState({})
  const [station, setStation] = useState(null)
  const [modalImage, setModalImage] = useState(null)

  useEffect(() => {
    let active = true
    api.get('/police/live-tracking').then(({ data }) => {
      if (active) {
        const items = data.data.emergencies || []
        setEmergencies(items)
        setLocations(Object.fromEntries(items.map(item => [item._id, item.driverLocation]).filter(([, location]) => location)))
      }
    }).catch(() => {})

    const cleanup = joinPoliceRoom(
      alert => {
        setEmergencies(current =>
          current.some(item => String(item._id) === String(alert.emergencyId))
            ? current
            : [{ _id: alert.emergencyId, location: alert.location, status: alert.status, userId: alert.userId, incidentImage: alert.incidentImage, incidentDetails: alert.incidentDetails }, ...current]
        )
        toast.success(`New emergency alert · ${String(alert.emergencyId).slice(-6)}`)
      },
      assignment => setAssignments(current => ({ ...current, [assignment.emergencyId]: assignment.driver })),
      update => setLocations(current => ({ ...current, [update.emergencyId]: update.location })),
      update => setEmergencies(current => current.map(item => String(item._id) === String(update.emergencyId) ? { ...item, location: update.location } : item))
    )
    return () => { active = false; cleanup() }
  }, [])

  useEffect(() => {
    let active = true
    const refreshTracking = () => api.get('/police/live-tracking').then(({ data }) => {
      if (!active) return
      const items = data.data.emergencies || []
      setEmergencies(items)
      setLocations(Object.fromEntries(items.map(item => [item._id, item.driverLocation || item.assignedDriverId?.currentLocation]).filter(([, location]) => location)))
    }).catch(() => {})

    const timer = window.setInterval(refreshTracking, 5000)
    return () => { active = false; window.clearInterval(timer) }
  }, [])

  useEffect(() => {
    const emergency = emergencies[0]
    if (!emergency?.location) return
    api.get(`/police/nearest-station?lat=${emergency.location.lat}&lng=${emergency.location.lng}`)
      .then(({ data }) => setStation(data.data.station))
      .catch(() => {})
  }, [emergencies[0]?.location?.lat, emergencies[0]?.location?.lng])

  return (
    <main className="min-h-screen bg-[#f7f7f5] px-4 py-6 text-slate-950">
      <div className="mx-auto w-full max-w-[760px]">
        <header className="flex items-center justify-between border-b border-slate-200 pb-5">
          <div>
            <div className="flex items-center gap-3">
              <img src="/emstrap-logo.png" alt="EmSTraP" className="h-12 w-auto" />
              <div className="flex items-center gap-1.5">
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
            <p className="mt-3 text-xs font-bold uppercase tracking-[.2em] text-red-600">Police command</p>
            <h1 className="mt-1 font-display text-3xl font-bold">Live emergency tracking</h1>
          </div>
          <span className="flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-700">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> Live channel
          </span>
        </header>

        <div className="mt-5 grid gap-4 md:grid-cols-[1.2fr_.8fr]">
          {emergencies.length ? (
            <section className="space-y-4">
              {emergencies.map(emergency => {
                const driver = assignments[emergency._id] || emergency.assignedDriverId
                const driverLocation = locations[emergency._id] || emergency.driverLocation || driver?.currentLocation
                const markerStyles = relativeMarkerStyles(emergency.location, driverLocation)
                const user = emergency.userId && typeof emergency.userId === 'object' ? emergency.userId : null
                const imageUrl = emergency.incidentImage?.url || (typeof emergency.incidentImage === 'string' ? emergency.incidentImage : null)

                return (
                  <article key={emergency._id} className="rounded-3xl border border-red-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-red-100 text-red-600">
                        <Siren size={22} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-red-600">Active emergency</p>
                            <h2 className="mt-1 text-lg font-bold">Incident {String(emergency._id).slice(-6)}</h2>
                          </div>
                          <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-700">
                            {emergency.status}
                          </span>
                        </div>
                        <p className="mt-2 flex items-center gap-1 break-words text-xs text-slate-500">
                          <MapPin size={13} /> Victim {user?.name ? `${user.name} · ` : ''}{user?.phone ? `${user.phone} · ` : ''}{emergency.location?.lat?.toFixed(5)}, {emergency.location?.lng?.toFixed(5)}
                        </p>
                        {emergency.incidentDetails && (
                          <p className="mt-1.5 text-xs text-slate-700 bg-slate-50 rounded-lg p-2 border border-slate-100">
                            <span className="font-semibold text-slate-900">Details: </span>{emergency.incidentDetails}
                          </p>
                        )}
                        {Number.isFinite(Number(emergency.location?.lat)) && Number.isFinite(Number(emergency.location?.lng)) && (
                          <a
                            href={`https://www.google.com/maps?q=${emergency.location.lat},${emergency.location.lng}`}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-block text-xs font-bold text-red-700 underline"
                          >
                            Open incident location in Maps
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Incident Evidence Photo uploaded by User */}
                    {imageUrl && (
                      <div className="mt-4 overflow-hidden rounded-2xl border border-red-200/80 bg-slate-950 p-2 text-white">
                        <div className="flex items-center justify-between px-1 pb-1.5 text-[11px] font-bold text-red-400">
                          <span className="flex items-center gap-1.5">
                            <Camera size={14} /> Incident Scene Evidence
                          </span>
                          <button
                            type="button"
                            onClick={() => setModalImage(imageUrl)}
                            className="flex items-center gap-1 rounded bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-slate-200 hover:bg-white/20 transition"
                          >
                            <Eye size={12} /> Full view
                          </button>
                        </div>
                        <div
                          onClick={() => setModalImage(imageUrl)}
                          className="group relative cursor-pointer overflow-hidden rounded-xl bg-black"
                        >
                          <img
                            src={imageUrl}
                            alt="Incident Evidence Scene"
                            className="h-44 w-full object-cover transition duration-300 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition group-hover:opacity-100 flex items-end justify-center p-2">
                            <span className="rounded bg-black/70 px-2 py-1 text-[11px] font-bold text-white">Click to enlarge</span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="driver-map mt-4 h-48">
                      <div className="driver-map-grid" />
                      <span className="driver-marker driver-marker-user" style={markerStyles.user}>
                        <MapPin size={16} fill="currentColor" />
                      </span>
                      {driverLocation && (
                        <span className="driver-marker driver-marker-you" style={markerStyles.driver}>
                          <LocateFixed size={15} />
                        </span>
                      )}
                      <div className="absolute bottom-2 left-2 flex gap-2">
                        <span className="rounded-lg bg-white/90 px-2 py-1 text-[10px] font-bold">Red: incident</span>
                        <span className="rounded-lg bg-white/90 px-2 py-1 text-[10px] font-bold">Green: driver live position</span>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
                      {driver?.selfie?.url ? (
                        <img src={driver.selfie.url} alt="Assigned driver" className="h-11 w-11 rounded-full object-cover" />
                      ) : (
                        <span className="grid h-11 w-11 place-items-center rounded-full bg-slate-200 text-slate-500">
                          <Ambulance size={19} />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold">{driver?.name || 'Waiting for driver assignment'}</p>
                          {driver && (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-red-700">
                              Govt Emergency Unit
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">
                          {driver
                            ? `${driver.phone || 'Driver contact protected'} · Live position ${driverLocation ? 'available' : 'pending'}${driverLocation?.lat != null ? ` · ${Number(driverLocation.lat).toFixed(5)}, ${Number(driverLocation.lng).toFixed(5)}` : ''}`
                            : 'Nearby government drivers alerted'}
                        </p>
                        {driverLocation?.lat != null && driverLocation?.lng != null && (
                          <a
                            href={`https://www.google.com/maps?q=${driverLocation.lat},${driverLocation.lng}`}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-block text-xs font-bold text-emerald-700 underline"
                          >
                            Track driver in Maps
                          </a>
                        )}
                      </div>
                      <Radio className={driverLocation ? 'text-emerald-600' : 'text-slate-400'} size={18} />
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
                  <h2 className="text-sm font-bold">Police response channel</h2>
                  <p className="mt-2 text-xs leading-5 text-slate-300">Only active emergency incidents are tracked in this view.</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Nearest station</p>
              <p className="mt-2 text-sm font-bold">{station?.stationName || station?.name || 'Command station lookup pending'}</p>
              <p className="mt-1 text-xs text-slate-500">{station ? `${station.distanceKm.toFixed(1)} km from incident` : 'Add police station coordinates to Atlas for nearest-station routing.'}</p>
            </div>
          </aside>
        </div>
      </div>

      {/* Lightbox / Modal for enlarged Incident Image */}
      {modalImage && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setModalImage(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-3xl overflow-hidden rounded-2xl bg-slate-950 p-2 shadow-2xl border border-slate-700"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 px-2 text-white">
              <div className="flex items-center gap-2">
                <Camera size={16} className="text-red-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-200">Incident Scene Evidence</span>
              </div>
              <button
                type="button"
                onClick={() => setModalImage(null)}
                className="rounded-full bg-white/10 p-1.5 text-slate-300 hover:bg-white/20 hover:text-white transition"
              >
                <X size={18} />
              </button>
            </div>
            <img
              src={modalImage}
              alt="Full incident scene evidence"
              className="max-h-[80vh] w-auto rounded-xl object-contain mx-auto"
            />
          </div>
        </div>
      )}
    </main>
  )
}
