import { Ambulance, ArrowUpRight, BadgeCheck, Camera, CheckCircle2, Clock3, HeartPulse, MapPin, Navigation, PhoneCall, ShieldAlert, Siren, UploadCloud, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import CameraCaptureModal from '../../components/CameraCaptureModal'
import EvidenceUploadModal from '../../components/EvidenceUploadModal'
import { dispatchEmergency, joinUserRoom, onDriverAssigned, onDriverLocationUpdated, onEmergencyCreated } from '../../services/emergencySocket'
import { useAuth } from '../../context/AuthContext'
import { normalizeCoords } from '../../utils/geoUtils'

const services = [
  { icon: Ambulance, title: 'Government ambulance', text: 'Fastest response for life-threatening emergencies', tone: 'red' },
  { icon: Clock3, title: 'Scheduled booking', text: 'Private ambulance for planned medical transport', tone: 'blue' }
]

export default function UserDashboard() {
  const { user, currentLocation } = useAuth()
  const [cameraOpen, setCameraOpen] = useState(false)
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  const [emergency, setEmergency] = useState(null)
  const [driver, setDriver] = useState(null)
  const [driverLocation, setDriverLocation] = useState(null)

  useEffect(() => {
    if (user?.id) {
      const unsub = joinUserRoom(user.id, emergency?._id || emergency?.emergencyId)
      return unsub
    }
  }, [user?.id, emergency?._id, emergency?.emergencyId])

  useEffect(() => {
    const removeCreated = onEmergencyCreated(event => {
      if (event?.data) {
        setEmergency(prev => ({ ...(prev || {}), ...event.data }))
      }
    })

    const removeAssigned = onDriverAssigned(assignment => {
      if (!assignment) return
      setEmergency(current => ({
        ...(current || {}),
        status: assignment.status || 'ACCEPTED',
        assignedDriverId: assignment.driver?.id || assignment.driver?._id || current?.assignedDriverId,
        driver: assignment.driver || current?.driver,
      }))
      if (assignment.driver) {
        setDriver(prev => ({ ...(prev || {}), ...assignment.driver }))
        const dLoc = normalizeCoords(assignment.driver.currentLocation)
        if (dLoc) setDriverLocation(dLoc)
      }
      toast.success('Ambulance driver has accepted your emergency request!')
    })

    const removeLocation = onDriverLocationUpdated(payload => {
      const normLoc = normalizeCoords(payload?.location)
      if (normLoc) {
        setDriverLocation(normLoc)
      }
    })

    return () => {
      removeCreated()
      removeAssigned()
      removeLocation()
    }
  }, [])

  const triggerSOS = () => setCameraOpen(true)

  const captured = async payload => {
    try {
      const dispatched = await dispatchEmergency({ ...payload, userId: user?.id })
      setCameraOpen(false)
      const emId = dispatched?.emergencyId || dispatched?._id
      if (dispatched?.merged) {
        toast.success('Alert already active for this location — your photo has been added to the existing emergency report')
      } else {
        toast.success('SOS sent. Nearby responders have been alerted.')
      }
      if (emId) {
        window.location.href = `/emergency/active/${emId}`
      }
    } catch (err) {
      setCameraOpen(false)
      const resData = err.response?.data?.data
      if (resData?.existingEmergencyId) {
        window.location.href = `/emergency/active/${resData.existingEmergencyId}`
        return
      }
      toast.error(err.response?.data?.message || err.message || 'Emergency dispatch failed')
    }
  }

  const validIncidentLoc = normalizeCoords(emergency?.location)
  const validDriverLoc = normalizeCoords(driverLocation)

  return (
    <AppShell>
      <div className="space-y-7">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[.2em] text-slate-500">Emergency Care Platform</p>
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Hello, {user?.name?.split(' ')[0] || 'User'} <span aria-hidden>👋</span>
            </h1>
            <p className="mt-2 text-slate-400">Your safety network is ready when you need it.</p>
          </div>
          <div className="flex w-fit items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300">
            <BadgeCheck size={15} /> Verified Account
          </div>
        </div>

        {emergency ? (
          <div className="glow-red overflow-hidden rounded-2xl border border-red-500/30 bg-red-500/10 p-5 space-y-4">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-4">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-red-500 text-white">
                  <Siren size={22} className="animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
                    <p className="text-xs font-bold uppercase tracking-widest text-red-300">
                      {emergency.status === 'ACCEPTED' ? 'Ambulance Assigned & En Route' : emergency.status === 'ARRIVED' ? 'Arrived on scene' : 'Active emergency'}
                    </p>
                  </div>
                  <h2 className="mt-1 font-display text-lg font-bold">
                    {emergency.status === 'ACCEPTED' ? 'Ambulance is responding to your location' : 'Help is on the way'}
                  </h2>
                  <p className="mt-1 text-sm text-red-100/70">
                    {emergency.status === 'ACCEPTED' ? 'Assigned government driver is moving towards you.' : 'Government ambulance dispatch is alerting nearby responders.'}
                  </p>
                  {validIncidentLoc && (
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-red-100/70">
                      <span className="flex items-center gap-1">
                        <MapPin size={13} /> {validIncidentLoc.lat.toFixed(4)}, {validIncidentLoc.lng.toFixed(4)}
                      </span>
                      <span className="flex items-center gap-1">
                        <CheckCircle2 size={13} /> Police notified
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => setEvidenceOpen(true)}
                className="flex shrink-0 items-center justify-center gap-2 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm font-bold text-red-100 hover:bg-red-400/20"
              >
                <UploadCloud size={16} /> Upload evidence
              </button>
            </div>

            {/* Assigned Driver Card */}
            {(driver?.name || emergency.driver?.name) && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-red-400/30 bg-slate-900/80 p-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-red-600 text-white">
                    <Ambulance size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">
                      {driver?.name || emergency.driver?.name || 'Assigned Govt Driver'}
                    </p>
                    <p className="text-xs text-slate-400 font-medium">
                      {driver?.phone || emergency.driver?.phone || 'Government Emergency Unit'}
                    </p>
                  </div>
                </div>
                {(driver?.phone || emergency.driver?.phone) && (
                  <a
                    href={`tel:${driver?.phone || emergency.driver?.phone}`}
                    className="flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow hover:bg-emerald-700"
                  >
                    <PhoneCall size={14} /> Call Driver
                  </a>
                )}
              </div>
            )}

            {/* Live Movement Map */}
            {validDriverLoc && (
              <div className="space-y-2">
                <div className="overflow-hidden rounded-xl border border-red-400/30 bg-slate-950">
                  <iframe
                    title="Driver GPS tracking"
                    className="h-44 w-full border-0"
                    loading="lazy"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${validDriverLoc.lng - 0.008}%2C${validDriverLoc.lat - 0.008}%2C${validDriverLoc.lng + 0.008}%2C${validDriverLoc.lat + 0.008}&layer=mapnik&marker=${validDriverLoc.lat}%2C${validDriverLoc.lng}`}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-red-200">
                  <span className="font-medium">
                    Live GPS: {validDriverLoc.lat.toFixed(5)}, {validDriverLoc.lng.toFixed(5)}
                  </span>
                  <a
                    href={`https://www.google.com/maps?q=${validDriverLoc.lat},${validDriverLoc.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold underline text-white"
                  >
                    Open in Maps
                  </a>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-3xl border border-red-500/20 bg-gradient-to-br from-red-950/80 via-slate-900 to-slate-900 p-6 sm:p-8">
            <div className="absolute -right-10 -top-20 h-56 w-56 rounded-full bg-red-500/10 blur-3xl" />
            <div className="relative max-w-xl">
              <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-red-300">
                <ShieldAlert size={16} /> Emergency response
              </div>
              <h2 className="font-display text-2xl font-bold sm:text-3xl">Need help right now?</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-300">
                Send your location and incident photo to the nearest government ambulance and police control room.
              </p>
              <button
                onClick={triggerSOS}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-red-500 px-5 py-3.5 font-bold text-white shadow-xl shadow-red-950/50 transition hover:bg-red-400 sm:w-auto"
              >
                <Siren size={18} /> Emergency SOS <ArrowUpRight size={17} />
              </button>
            </div>
          </div>
        )}

        <section>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.18em] text-slate-500">Services</p>
              <h2 className="mt-1 font-display text-xl font-bold">How can we help?</h2>
            </div>
            <Link to="/booking" className="text-xs font-semibold text-sky-400 hover:text-sky-300">
              View all services
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {services.map(({ icon: Icon, title, text, tone }, index) => (
              <Link
                key={title}
                to={index ? '/booking' : '#'}
                onClick={index ? undefined : event => { event.preventDefault(); triggerSOS() }}
                className={`group rounded-2xl border p-5 transition hover:-translate-y-0.5 ${tone === 'red' ? 'border-red-500/20 bg-red-500/[.06] hover:border-red-400/40' : 'border-sky-500/20 bg-sky-500/[.05] hover:border-sky-400/40'}`}
              >
                <div className={`mb-5 grid h-11 w-11 place-items-center rounded-xl ${tone === 'red' ? 'bg-red-500/15 text-red-400' : 'bg-sky-500/15 text-sky-400'}`}>
                  <Icon size={21} />
                </div>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold">{title}</h3>
                    <p className="mt-1 max-w-xs text-sm leading-5 text-slate-400">{text}</p>
                  </div>
                  <ArrowUpRight className="text-slate-600 transition group-hover:text-slate-300" size={18} />
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>

      {cameraOpen && <CameraCaptureModal onClose={() => setCameraOpen(false)} onCaptured={captured} fallbackLocation={currentLocation} />}
      {evidenceOpen && <EvidenceUploadModal onClose={() => setEvidenceOpen(false)} />}
    </AppShell>
  )
}
