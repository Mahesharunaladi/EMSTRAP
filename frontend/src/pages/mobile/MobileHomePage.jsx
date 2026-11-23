import { Ambulance, ArrowRight, CalendarClock, ChevronRight, HeartPulse, LocateFixed, MapPin, PhoneCall, ShieldAlert, Siren } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import MobileAppShell from '../../components/MobileAppShell'
import BookedAmbulanceCard from '../../components/BookedAmbulanceCard'
import CameraCaptureModal from '../../components/CameraCaptureModal'
import LocationSearchModal from '../../components/LocationSearchModal'
import { dispatchEmergency, joinUserRoom, onDriverAssigned, onDriverLocationUpdated, onEmergencyCreated, sendUserLocation } from '../../services/emergencySocket'
import { useAuth } from '../../context/AuthContext'
import useUserBookings from '../../hooks/useUserBookings'
import { normalizeCoords } from '../../utils/geoUtils'

const quickActions = [
  { title: 'Emergency SOS', description: 'Government ambulance now', icon: Siren, className: 'mobile-emergency-card' },
  { title: 'Book ambulance', description: 'Plan an ambulance ride', icon: CalendarClock, className: 'mobile-booking-card' },
]
const activeStatuses = new Set(['PENDING', 'ACCEPTED', 'STARTED'])

export default function MobileHomePage() {
  const navigate = useNavigate()
  const { user, currentLocation, updateLocation } = useAuth()
  const { bookings, emergencies } = useUserBookings()
  const [cameraOpen, setCameraOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [selectedAddress, setSelectedAddress] = useState(() => user?.currentLocation?.address || '')
  const [emergency, setEmergency] = useState(null)
  const [driver, setDriver] = useState(null)
  const [driverLocation, setDriverLocation] = useState(null)
  const [driverPhoto, setDriverPhoto] = useState(null)
  const [cooldownSeconds, setCooldownSeconds] = useState(0)
  const activeBooking = (bookings || []).find(booking => activeStatuses.has(booking?.status))

  // 30-Minute Cooldown live countdown timer
  useEffect(() => {
    if (!emergency?.createdAt) {
      setCooldownSeconds(0)
      return
    }
    const calcRemaining = () => {
      const elapsed = Date.now() - new Date(emergency.createdAt).getTime()
      const remaining = Math.max(0, Math.ceil((30 * 60 * 1000 - elapsed) / 1000))
      return remaining
    }
    setCooldownSeconds(calcRemaining())
    const interval = setInterval(() => {
      const rem = calcRemaining()
      setCooldownSeconds(rem)
      if (rem <= 0) clearInterval(interval)
    }, 1000)
    return () => clearInterval(interval)
  }, [emergency?.createdAt])

  // Restore latest active emergency from backend if not yet set in state
  useEffect(() => {
    if (!emergency && emergencies && emergencies.length > 0) {
      const activeEmerg = emergencies.find(e => ['PENDING', 'ACCEPTED', 'ARRIVED'].includes(e.status))
      if (activeEmerg) {
        setEmergency(activeEmerg)
        if (activeEmerg.driver) {
          setDriver(activeEmerg.driver)
          if (activeEmerg.driver.photo || activeEmerg.driver.selfie?.url) {
            setDriverPhoto(activeEmerg.driver.photo || activeEmerg.driver.selfie?.url)
          }
        }
        const normLoc = normalizeCoords(activeEmerg.driverLocation || activeEmerg.driver?.currentLocation)
        if (normLoc) {
          setDriverLocation(normLoc)
        }
      }
    }
  }, [emergencies, emergency])

  useEffect(() => {
    if (currentLocation?.address) {
      setSelectedAddress(currentLocation.address)
    } else if (user?.currentLocation?.address) {
      setSelectedAddress(user.currentLocation.address)
    } else if (currentLocation?.lat && currentLocation?.lng) {
      setSelectedAddress(`${Number(currentLocation.lat).toFixed(4)}, ${Number(currentLocation.lng).toFixed(4)}`)
    }
  }, [currentLocation?.address, user?.currentLocation?.address, currentLocation?.lat, currentLocation?.lng])

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
        const photo = assignment.driver.selfie?.url || assignment.driver.photo
        if (photo) setDriverPhoto(photo)
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
      if (payload?.driverPhoto) setDriverPhoto(payload.driverPhoto)
    })

    return () => { removeCreated(); removeAssigned(); removeLocation() }
  }, [])

  useEffect(() => {
    if (emergency?.emergencyId && currentLocation) {
      const normUserLoc = normalizeCoords(currentLocation)
      if (normUserLoc) {
        sendUserLocation({ emergencyId: emergency.emergencyId, lat: normUserLoc.lat, lng: normUserLoc.lng })
      }
    }
  }, [emergency?.emergencyId, currentLocation])

  const capture = async payload => {
    try {
      const data = await dispatchEmergency({ ...payload, userId: user?.id })
      setCameraOpen(false)
      if (data) {
        const emId = data.emergencyId || data._id
        setEmergency(prev => ({ ...(prev || {}), ...data }))
        if (data.merged) {
          toast.success('Alert already active for this location — your photo has been added to the existing emergency report')
        } else {
          toast.success('SOS sent! Government ambulance and police alerted.')
        }
        if (emId) {
          navigate(`/emergency/active/${emId}`)
          return
        }
      }
    } catch (err) {
      setCameraOpen(false)
      const resData = err.response?.data?.data
      if (resData?.existingEmergencyId) {
        navigate(`/emergency/active/${resData.existingEmergencyId}`)
        return
      }
      if (resData?.remainingSeconds) {
        setCooldownSeconds(resData.remainingSeconds)
      }
      toast.error(err.response?.data?.message || err.message || 'Emergency dispatch failed')
    }
  }

  const validDriverLoc = normalizeCoords(driverLocation)
  const validEmergencyLoc = normalizeCoords(emergency?.location)

  return <MobileAppShell>
    <section>
      <p className="text-xs font-bold uppercase tracking-[.18em] text-slate-500">Emergency medical care</p>
      <h1 className="mt-1 font-display text-[2rem] font-bold leading-tight tracking-tight">How can we help?</h1>
      <p className="mt-2 text-sm leading-5 text-slate-500">Get the right help, wherever you are.</p>
    </section>

    <button onClick={() => setSearchOpen(true)} className="mobile-search mt-5 flex w-full items-center gap-3 text-left">
      <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-500"><MapPin size={18} /></span>
      <span className="flex-1 truncate text-sm font-semibold text-slate-500">{selectedAddress || 'Detecting your location…'}</span>
      <span className="rounded-full bg-slate-950 px-3 py-2 text-xs font-bold text-white">Search</span>
    </button>

    {activeBooking && <section className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4">
      <div className="mb-3 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-blue-700">Your ambulance booking</p><h2 className="mt-1 text-sm font-bold">Ride updates</h2></div><Ambulance className="text-blue-700" size={21} /></div>
      <BookedAmbulanceCard booking={activeBooking} />
      <Link to="/app/activity" className="mt-3 flex items-center justify-center gap-1 text-xs font-bold text-blue-800">View all ride activity <ChevronRight size={15} /></Link>
    </section>}

    {emergency && <section className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-red-600 text-white shadow-md shadow-red-200">
          <Siren size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-red-700">Emergency active</p>
            <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${emergency.status === 'ACCEPTED' || emergency.status === 'ARRIVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
              {emergency.status === 'ACCEPTED' ? 'Driver accepted' : emergency.status === 'ARRIVED' ? 'Arrived on scene' : 'Searching for responders'}
            </span>
          </div>
          {emergency.createdAt && (
            <p className="text-[10px] text-slate-500 mt-0.5 font-medium">
              Incident Reported: {new Date(emergency.createdAt).toLocaleTimeString()}
            </p>
          )}
          <p className="text-sm font-bold">
            {emergency.status === 'ACCEPTED' ? 'Ambulance responding to your incident' : emergency.status === 'ARRIVED' ? 'Ambulance arrived at your location' : 'Help is on the way'}
          </p>
        </div>
      </div>

      {validEmergencyLoc && (
        <div className="mt-3 flex items-start gap-2 text-xs text-slate-700 bg-white/80 p-2.5 rounded-xl border border-red-100">
          <MapPin size={15} className="mt-0.5 shrink-0 text-red-600" />
          <span><b>Incident Location:</b> {validEmergencyLoc.lat.toFixed(5)}, {validEmergencyLoc.lng.toFixed(5)}</span>
        </div>
      )}
      
      {/* Realtime OpenStreetMap embed when driver location is live */}
      {validDriverLoc ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-red-200 bg-slate-100 shadow-inner">
          <iframe
            title="Emergency Driver Tracking"
            className="h-48 w-full border-0"
            loading="lazy"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${validDriverLoc.lng - 0.008}%2C${validDriverLoc.lat - 0.008}%2C${validDriverLoc.lng + 0.008}%2C${validDriverLoc.lat + 0.008}&layer=mapnik&marker=${validDriverLoc.lat}%2C${validDriverLoc.lng}`}
          />
        </div>
      ) : (
        <div className="driver-map mt-4 h-44"><div className="driver-map-grid" /><span className="driver-marker driver-marker-user"><MapPin size={16} fill="currentColor" /></span><div className="absolute bottom-2 left-2 rounded-lg bg-white/90 px-2 py-1 text-[10px] font-bold">{emergency.status === 'ACCEPTED' ? 'Driver accepted! Connecting GPS feed...' : "Waiting for responder's GPS coordinates..."}</div></div>
      )}

      {validDriverLoc && (
        <div className="mt-3 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-900">
          <span className="flex items-center gap-1.5 font-bold">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Live ambulance coordinates: {validDriverLoc.lat.toFixed(5)}, {validDriverLoc.lng.toFixed(5)}
          </span>
          <a
            href={`https://www.google.com/maps?q=${validDriverLoc.lat},${validDriverLoc.lng}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-emerald-700 px-2.5 py-1 text-[11px] font-bold text-white shadow hover:bg-emerald-800"
          >
            Google Maps
          </a>
        </div>
      )}

      {(driverPhoto || driver?.name || driver?.phone) && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-white p-3.5 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            {driverPhoto ? (
              <img src={driverPhoto} alt="Assigned driver" className="h-12 w-12 rounded-full object-cover border-2 border-red-200 shadow-sm" />
            ) : (
              <span className="grid h-12 w-12 place-items-center rounded-full bg-red-600 text-white shadow-sm">
                <Ambulance size={22} />
              </span>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold text-slate-900 truncate">{driver?.name || 'Assigned Govt Driver'}</p>
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-red-800">Govt Response</span>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5 font-medium">{driver?.phone ? `Phone: ${driver.phone}` : 'Government Emergency Unit'}</p>
            </div>
          </div>
          {driver?.phone && (
            <a
              href={`tel:${driver.phone}`}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-600/30 hover:bg-emerald-700 transition"
            >
              <PhoneCall size={14} /> Call Driver
            </a>
          )}
        </div>
      )}

      {/* 30-Minute Cooldown & Evidence Upload Action */}
      <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-red-100/60 p-3 border border-red-200 text-xs">
        <div>
          <p className="font-bold text-red-900">
            {cooldownSeconds > 0 ? (
              <>Duplicate Alert Locked ({Math.floor(cooldownSeconds / 60)}:{String(cooldownSeconds % 60).padStart(2, '0')})</>
            ) : (
              'Incident Dispatched'
            )}
          </p>
          <p className="text-[10px] text-red-700">Responders locked to this emergency</p>
        </div>
        <button
          onClick={() => setCameraOpen(true)}
          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-red-700"
        >
          Add Evidence Photo
        </button>
      </div>
    </section>}

    <section className="mt-7">
      <div className="mb-3 flex items-center justify-between"><h2 className="font-display text-xl font-bold">Quick help</h2><Link to="/app/services" className="text-xs font-bold text-red-600">See all</Link></div>
      <div className="grid grid-cols-2 gap-3">{quickActions.map(({ title, description, icon: Icon, className }, index) => <button key={title} onClick={() => {
          if (index === 0) {
            if (cooldownSeconds > 0) {
              toast(`Active emergency is in progress (${Math.floor(cooldownSeconds / 60)}m ${cooldownSeconds % 60}s remaining). You can add scene evidence photos.`, { icon: '🚨' });
            }
            setCameraOpen(true);
          } else {
            navigate('/booking');
          }
        }} className={`mobile-action-card ${className} text-left`}>
        <span className="mb-8 grid h-11 w-11 place-items-center rounded-2xl bg-white/80"><Icon size={22} /></span><span className="block text-sm font-bold">{title}</span><span className="mt-1 block text-xs leading-4 opacity-70">{description}</span><ArrowRight className="absolute bottom-4 right-4" size={16} />
      </button>)}</div>
    </section>

    <section className="mt-7">
      <div className="mb-3 flex items-center justify-between"><h2 className="font-display text-xl font-bold">For your care</h2><HeartPulse className="text-red-600" size={20} /></div>
      <div className="mobile-care-card"><div><span className="rounded-full bg-red-600 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white">Always ready</span><h3 className="mt-3 max-w-[220px] font-display text-xl font-bold">Your care network is one tap away.</h3><p className="mt-2 max-w-[230px] text-xs leading-5 text-slate-600">Verified ambulance partners and emergency teams connected for you.</p></div><div className="mobile-care-icon"><Ambulance size={32} /></div></div>
    </section>

    <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-emerald-100 text-emerald-600"><ShieldAlert size={18} /></span><div><h3 className="text-sm font-bold">Email verified</h3><p className="text-xs text-slate-500">Your emergency profile is protected.</p></div><ChevronRight className="ml-auto text-slate-400" size={18} /></div></section>

    {cameraOpen && <CameraCaptureModal onClose={() => setCameraOpen(false)} onCaptured={capture} fallbackLocation={currentLocation} />}
    {searchOpen && (
      <LocationSearchModal
        onClose={() => setSearchOpen(false)}
        onSelected={result => {
          setSelectedAddress(result.address || result.displayName)
          updateLocation(result)
        }}
      />
    )}
  </MobileAppShell>
}
