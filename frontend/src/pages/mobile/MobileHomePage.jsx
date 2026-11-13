import { Ambulance, ArrowRight, CalendarClock, ChevronRight, HeartPulse, LocateFixed, MapPin, ShieldAlert, Siren } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import MobileAppShell from '../../components/MobileAppShell'
import BookedAmbulanceCard from '../../components/BookedAmbulanceCard'
import CameraCaptureModal from '../../components/CameraCaptureModal'
import LocationSearchModal from '../../components/LocationSearchModal'
import { dispatchEmergency, onDriverLocationUpdated, onEmergencyCreated, sendUserLocation } from '../../services/emergencySocket'
import { useAuth } from '../../context/AuthContext'
import useUserBookings from '../../hooks/useUserBookings'

const quickActions = [
  { title: 'Emergency SOS', description: 'Government ambulance now', icon: Siren, className: 'mobile-emergency-card' },
  { title: 'Book ambulance', description: 'Plan an ambulance ride', icon: CalendarClock, className: 'mobile-booking-card' },
]
const activeStatuses = new Set(['PENDING', 'ACCEPTED', 'STARTED'])

export default function MobileHomePage() {
  const navigate = useNavigate()
  const { user, currentLocation, updateLocation } = useAuth()
  const { bookings } = useUserBookings()
  const [cameraOpen, setCameraOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [selectedAddress, setSelectedAddress] = useState(() => user?.currentLocation?.address || '')
  const [emergency, setEmergency] = useState(null)
  const [driverLocation, setDriverLocation] = useState(null)
  const [driverPhoto, setDriverPhoto] = useState(null)
  const activeBooking = bookings.find(booking => activeStatuses.has(booking.status))

  useEffect(() => {
    if (currentLocation?.address) {
      setSelectedAddress(currentLocation.address)
    } else if (user?.currentLocation?.address) {
      setSelectedAddress(user.currentLocation.address)
    } else if (currentLocation?.lat && currentLocation?.lng) {
      setSelectedAddress(`${currentLocation.lat.toFixed(4)}, ${currentLocation.lng.toFixed(4)}`)
    }
  }, [currentLocation?.address, user?.currentLocation?.address, currentLocation?.lat, currentLocation?.lng])

  useEffect(() => {
    const removeCreated = onEmergencyCreated(event => setEmergency(event.data))
    const removeLocation = onDriverLocationUpdated(payload => {
      setDriverLocation(payload.location)
      if (payload.driverPhoto) setDriverPhoto(payload.driverPhoto)
    })
    return () => { removeCreated(); removeLocation() }
  }, [])

  useEffect(() => {
    if (emergency?.emergencyId && currentLocation) sendUserLocation({ emergencyId: emergency.emergencyId, lat: currentLocation.lat, lng: currentLocation.lng })
  }, [emergency?.emergencyId, currentLocation?.lat, currentLocation?.lng])

  const capture = async payload => {
    await dispatchEmergency({ ...payload, userId: user?.id })
    setCameraOpen(false)
    toast.success('SOS sent. Nearby responders are being alerted.')
  }

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
      <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-red-600 text-white"><Siren size={19} /></span><div><p className="text-xs font-bold uppercase tracking-wider text-red-700">Emergency active</p><p className="text-sm font-bold">Help is on the way</p></div></div>
      <div className="driver-map mt-4 h-44"><div className="driver-map-grid" /><span className="driver-marker driver-marker-user"><MapPin size={16} fill="currentColor" /></span>{driverLocation && <span className="driver-marker driver-marker-you"><LocateFixed size={15} /></span>}<div className="absolute bottom-2 left-2 rounded-lg bg-white/90 px-2 py-1 text-[10px] font-bold">{driverLocation ? 'Driver location live' : 'Waiting for driver location'}</div></div>
      {driverPhoto && <div className="mt-3 flex items-center gap-3"><img src={driverPhoto} alt="Assigned driver" className="h-10 w-10 rounded-full object-cover" /><div><p className="text-xs font-bold">Your assigned driver</p><p className="text-[11px] text-slate-600">Verified driver photo</p></div></div>}
    </section>}

    <section className="mt-7">
      <div className="mb-3 flex items-center justify-between"><h2 className="font-display text-xl font-bold">Quick help</h2><Link to="/app/services" className="text-xs font-bold text-red-600">See all</Link></div>
      <div className="grid grid-cols-2 gap-3">{quickActions.map(({ title, description, icon: Icon, className }, index) => <button key={title} onClick={() => index ? navigate('/booking') : setCameraOpen(true)} className={`mobile-action-card ${className} text-left`}>
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
