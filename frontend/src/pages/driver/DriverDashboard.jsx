import { Ambulance, CircleUserRound, LocateFixed, MapPin, Navigation, Radio, Siren } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import DriverAppShell from './DriverAppShell'
import api from '../../services/api'
import { acceptEmergency, joinDriverRoom, onUserLocationUpdated, sendDriverLocation } from '../../services/emergencySocket'

function coords(point) {
  return Number.isFinite(Number(point?.lat)) && Number.isFinite(Number(point?.lng))
}

function mapsUrl(point) {
  return `https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}&travelmode=driving`
}

function routeUrl(pickup, destination) {
  return `https://www.google.com/maps/dir/?api=1&origin=${pickup.lat},${pickup.lng}&destination=${destination.lat},${destination.lng}&travelmode=driving`
}

export default function DriverDashboard() {
  const [driver, setDriver] = useState(null)
  const [emergency, setEmergency] = useState(null)
  const [bookings, setBookings] = useState([])
  const [canReceiveBookings, setCanReceiveBookings] = useState(false)
  const [online, setOnline] = useState(true)
  const [locationStatus, setLocationStatus] = useState('Location sharing starts after accepting a request')

  const loadDashboard = useCallback(async () => {
    const [me, alert, bookingResponse] = await Promise.allSettled([
        api.get('/driver/me'), api.get('/driver/active-emergency'), api.get('/driver/bookings'),
    ])
    if (me.status === 'rejected') {
      if (me.reason.response?.status === 401) window.location.href = '/driver'
      return
    }
    setDriver(me.value.data.data.driver)
    if (alert.status === 'fulfilled') setEmergency(alert.value.data.data.emergency)
    if (bookingResponse.status === 'fulfilled') {
      setBookings(bookingResponse.value.data.data.bookings || [])
      setCanReceiveBookings(Boolean(bookingResponse.value.data.data.canReceiveBookings))
    } else if (bookingResponse.reason.response?.status === 403) {
      setBookings([])
      setCanReceiveBookings(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    const refresh = async () => { if (active) await loadDashboard() }
    refresh()
    const timer = window.setInterval(refresh, 5000)
    return () => { active = false; window.clearInterval(timer) }
  }, [loadDashboard])

  useEffect(() => {
    if (!driver?.id) return undefined
    const onNewBooking = booking => {
      setBookings(current => [booking, ...current.filter(item => String(item._id) !== String(booking._id))])
      toast.success('New ambulance booking · pickup and drop-off received')
    }
    const onBookingAssignment = ({ booking, driver: assignedDriver }) => {
      if (String(assignedDriver?.id) === String(driver.id)) {
        setBookings(current => [booking, ...current.filter(item => String(item._id) !== String(booking._id))])
      } else {
        setBookings(current => current.filter(item => String(item._id) !== String(booking?._id)))
      }
    }
    return joinDriverRoom(
      driver.id,
      alert => { setEmergency(alert); toast.success('New emergency alert received') },
      driver.driverType,
      assignment => setEmergency(current => {
        if (!current || String(current._id || current.emergencyId) !== String(assignment.emergencyId)) return current
        return String(assignment.driver?.id) === String(driver.id) ? { ...current, status: assignment.status, assignedDriverId: driver.id } : null
      }),
      onNewBooking,
      onBookingAssignment,
    )
  }, [driver?.id, driver?.driverType])

  useEffect(() => onUserLocationUpdated(payload => {
    if (emergency && String(payload.emergencyId) === String(emergency._id || emergency.emergencyId)) {
      setEmergency(current => ({ ...current, location: payload.location }))
    }
  }), [driver?.id, emergency?._id, emergency?.emergencyId])

  const activeBooking = useMemo(() => bookings.find(booking => ['ACCEPTED', 'STARTED'].includes(booking.status) && String(booking.assignedDriverId) === String(driver?.id)) || null, [bookings, driver?.id])

  useEffect(() => {
    if (!driver?.id || !activeBooking || !navigator.geolocation) {
      setLocationStatus('Location sharing starts after accepting a booking')
      return undefined
    }
    if (!window.isSecureContext) {
      setLocationStatus('Open this portal over HTTPS or localhost to share live GPS')
      return undefined
    }
    let active = true
    let lastSentAt = 0
    const watchId = navigator.geolocation.watchPosition(({ coords: position }) => {
      const now = Date.now()
      if (now - lastSentAt < 5000) return
      lastSentAt = now
      api.patch(`/driver/bookings/${activeBooking._id}/location`, { location: { lat: position.latitude, lng: position.longitude, source: 'browser-gps' } })
        .then(() => { if (active) setLocationStatus('Live driver location shared with the customer') })
        .catch(() => { if (active) setLocationStatus('Unable to share live location') })
    }, error => {
      if (active) setLocationStatus(error.code === 1 ? 'Allow location access to share your live position' : 'Waiting for a GPS fix')
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 })
    return () => { active = false; navigator.geolocation.clearWatch(watchId) }
  }, [driver?.id, activeBooking?._id])

  const accept = () => {
    const emergencyId = emergency?._id || emergency?.emergencyId
    if (!emergencyId || !driver?.id) return
    acceptEmergency(emergencyId, driver.id)
    setEmergency(current => ({ ...current, status: 'ACCEPTED', assignedDriverId: driver.id }))
    toast.success('Emergency accepted')
  }

  async function acceptBooking(booking) {
    try {
      const { data } = await api.post(`/driver/bookings/${booking._id}/accept`)
      setBookings(current => [data.data.booking, ...current.filter(item => String(item._id) !== String(booking._id))])
      toast.success('Booking accepted. Pickup and drop-off are ready.')
    } catch (error) { toast.error(error.response?.data?.message || 'This booking is no longer available') }
  }

  async function updateBookingStatus(booking, status) {
    try {
      const { data } = await api.patch(`/driver/bookings/${booking._id}/status`, { status })
      setBookings(current => current.map(item => String(item._id) === String(booking._id) ? data.data.booking : item))
      toast.success(status === 'STARTED' ? 'Trip started' : 'Trip completed')
    } catch (error) { toast.error(error.response?.data?.message || 'Unable to update trip') }
  }

  return <DriverAppShell driver={driver}>
    <div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-red-600">Dispatch center</p><h1 className="mt-1 font-display text-3xl font-bold">Driver dashboard</h1></div><button disabled={!canReceiveBookings} onClick={() => setOnline(value => !value)} className={`flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 ${online ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}><span className={`h-2 w-2 rounded-full ${canReceiveBookings && online ? 'bg-emerald-500' : 'bg-slate-400'}`} />{canReceiveBookings ? online ? 'Online' : 'Offline' : 'Not dispatch-ready'}</button></div>
    {driver?.status !== 'ACTIVE' && <section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><h2 className="font-bold">Driver account: {(driver?.status || 'PENDING_REVIEW').replaceAll('_', ' ')}</h2><p className="mt-1 text-xs leading-5">{driver?.status === 'PENDING_DOCUMENTS' ? 'Submit your selfie and driving license before receiving rides.' : driver?.status === 'SUSPENDED' ? 'Your driver account is suspended. Contact the administrator for help.' : canReceiveBookings ? 'Approval is temporarily not required. You can receive and accept rides while your documents are pending review.' : 'Your documents are awaiting approval. Make sure your email is verified and both required documents are uploaded.'}</p></section>}
    <div className="mt-5 flex items-center gap-2 text-xs font-semibold text-emerald-700"><LocateFixed size={14} /> {locationStatus}</div>

    {emergency && <section className="driver-alert mt-5"><div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-red-600 text-white"><Siren size={22} /></span><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-widest text-red-700">Emergency dispatch</p><h2 className="mt-1 text-lg font-bold">User needs an ambulance</h2><p className="mt-1 break-words text-xs text-slate-600">Pickup: {emergency.location?.lat?.toFixed(5)}, {emergency.location?.lng?.toFixed(5)}</p>{coords(emergency.location) && <a href={mapsUrl(emergency.location)} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-bold text-red-700 underline">Directions to emergency pickup</a>}</div></div><button onClick={accept} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 py-3 text-sm font-bold text-white"><Radio size={16} /> {emergency.status === 'ACCEPTED' ? 'Accepted' : 'Accept emergency'}</button></section>}

    <section className="mt-5 space-y-3"><div className="flex items-center justify-between"><h2 className="font-display text-xl font-bold">Ambulance bookings</h2><span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700">{bookings.filter(item => item.status === 'PENDING').length} new</span></div>
      {bookings.length ? bookings.map(booking => <article key={booking._id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-wider text-red-600">{booking.tier} transport · {booking.status}</p><h3 className="mt-1 text-sm font-bold">{booking.customerName || 'Ambulance booking'}</h3></div><Ambulance className="shrink-0 text-slate-500" size={20} /></div><div className="mt-3 space-y-2 text-xs"><p className="flex gap-2"><MapPin className="shrink-0 text-emerald-600" size={15} /><span><b>Pickup:</b> {booking.pickup}<br />{booking.pickupLocation?.lat?.toFixed(5)}, {booking.pickupLocation?.lng?.toFixed(5)}</span></p><p className="flex gap-2"><MapPin className="shrink-0 text-red-600" size={15} /><span><b>Drop-off:</b> {booking.destination}<br />{booking.destinationLocation?.lat?.toFixed(5)}, {booking.destinationLocation?.lng?.toFixed(5)}</span></p></div>{booking.status === 'PENDING' ? <button onClick={() => acceptBooking(booking)} className="mt-4 w-full rounded-xl bg-slate-950 py-3 text-sm font-bold text-white">Accept booking</button> : <div className="mt-4 space-y-2">{coords(booking.pickupLocation) && <a href={mapsUrl(booking.pickupLocation)} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-xl bg-emerald-700 py-3 text-sm font-bold text-white"><Navigation size={16} /> Directions to pickup</a>}{coords(booking.pickupLocation) && coords(booking.destinationLocation) && <a href={routeUrl(booking.pickupLocation, booking.destinationLocation)} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 py-3 text-sm font-bold text-slate-800">View pickup-to-drop-off route</a>}{booking.status === 'ACCEPTED' && <button onClick={() => updateBookingStatus(booking, 'STARTED')} className="w-full rounded-xl bg-red-600 py-3 text-sm font-bold text-white">Start trip</button>}{booking.status === 'STARTED' && <button onClick={() => updateBookingStatus(booking, 'COMPLETED')} className="w-full rounded-xl bg-slate-950 py-3 text-sm font-bold text-white">Complete trip</button>}</div>}</article>) : <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center"><Ambulance className="mx-auto text-slate-400" size={26} /><h3 className="mt-3 font-bold">No active bookings</h3><p className="mt-1 text-xs text-slate-500">New pickup and drop-off requests will appear here.</p></div>}
    </section>

    <Link to="/driver/profile" className="mt-5 flex items-center justify-center gap-2 text-sm font-bold text-slate-600"><CircleUserRound size={17} /> View driver profile</Link>
  </DriverAppShell>
}
