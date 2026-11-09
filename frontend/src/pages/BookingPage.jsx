import { Ambulance, ArrowLeft, ArrowRight, Baby, Check, HeartPulse, LoaderCircle, MapPin, Search, Scale, ShieldCheck } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import MobileAppShell from '../components/MobileAppShell'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

const tiers = [
  { name: 'Basic', tier: 'STANDARD', description: 'Comfortable transport for standard patient needs.', price: '₹150/km', icon: Ambulance, color: 'blue', features: ['Patient transport', 'Basic first-aid kit'] },
  { name: 'Oxygen', tier: 'SPECIAL', description: 'Transport with oxygen support.', price: '₹200/km', icon: HeartPulse, color: 'purple', features: ['Oxygen support', 'Trained ambulance crew'] },
  { name: 'ICU', tier: 'ICU', description: 'Critical care transport with advanced life support.', price: '₹300/km', icon: Scale, color: 'amber', features: ['Advanced life support', 'Critical care equipment'] },
  { name: 'Pregnancy care', tier: 'PREGNANCY', description: 'Specialized transport for pregnancy-related needs.', price: '₹250/km', icon: Baby, color: 'pink', features: ['Pregnancy-trained crew', 'Hospital coordination'] },
]

const coordinatesLabel = point => `${Number(point.lat).toFixed(6)}, ${Number(point.lng).toFixed(6)}`

export default function BookingPage() {
  const [searchParams] = useSearchParams()
  const { currentLocation } = useAuth()
  const [selected, setSelected] = useState(() => tiers.find(tier => tier.name.toLowerCase() === searchParams.get('care')?.toLowerCase())?.name || null)
  const [step, setStep] = useState(1)
  const [pickup, setPickup] = useState('')
  const [pickupCoords, setPickupCoords] = useState(null)
  const [destination, setDestination] = useState('')
  const [destinationCoords, setDestinationCoords] = useState(null)
  const [destinationResults, setDestinationResults] = useState([])
  const [searchingDestination, setSearchingDestination] = useState(false)
  const [booking, setBooking] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [locationState, setLocationState] = useState('idle')
  const locationRequest = useRef(false)
  const reverseLookupAttempted = useRef(false)

  const lookupAddress = useCallback(async point => {
    if (reverseLookupAttempted.current) return null
    reverseLookupAttempted.current = true
    try {
      const { data } = await api.get('/location/reverse', { params: { lat: point.lat, lng: point.lng } })
      return data.data.address || null
    } catch { return null }
  }, [])

  const applyPickup = useCallback(point => {
    const location = { lat: Number(point.lat), lng: Number(point.lng), source: 'browser-gps' }
    setPickupCoords(location)
    const coordinates = coordinatesLabel(location)
    setPickup(coordinates)
    setLocationState('locating')
    lookupAddress(location).then(address => {
      setPickup(address || coordinates)
      setLocationState(address ? 'ready' : 'coordinates')
      api.patch('/auth/location', { ...location, address: address || undefined }).catch(() => {})
    })
  }, [lookupAddress])

  const locatePickup = useCallback(() => {
    setLocationState('locating')
    if (!window.isSecureContext) { setLocationState('insecure-context'); return }
    if (!navigator.geolocation) { setLocationState('unsupported'); return }
    navigator.geolocation.getCurrentPosition(({ coords }) => applyPickup({ lat: coords.latitude, lng: coords.longitude }), error => {
      if (error.code === 1) setLocationState('permission')
      else if (error.code === 3) setLocationState('timeout')
      else setLocationState('unavailable')
    }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 })
  }, [applyPickup])

  useEffect(() => {
    if (step !== 2 || locationRequest.current) return
    locationRequest.current = true
    if (currentLocation?.source === 'browser-gps' && Number.isFinite(Number(currentLocation.lat)) && Number.isFinite(Number(currentLocation.lng))) applyPickup(currentLocation)
    else locatePickup()
  }, [step, currentLocation, applyPickup, locatePickup])

  const retryLocation = () => { locationRequest.current = true; locatePickup() }

  async function searchDestination() {
    if (destination.trim().length < 3) return toast.error('Enter at least 3 characters for the drop-off')
    setSearchingDestination(true)
    try {
      const { data } = await api.get('/location/search', { params: { q: destination.trim() } })
      setDestinationResults(data.data || [])
      if (!data.data?.length) toast.error('No matching drop-off address found')
    } catch (error) { toast.error(error.response?.data?.message || 'Could not find that drop-off address') }
    finally { setSearchingDestination(false) }
  }

  async function requestAmbulance() {
    if (!selected || !pickupCoords || !destinationCoords) return toast.error('Choose a service, confirm your live pickup, and select a drop-off result')
    setSubmitting(true)
    try {
      const tier = tiers.find(item => item.name === selected)
      const { data } = await api.post('/bookings', {
        tier: tier.tier,
        pickup,
        pickupLocation: pickupCoords,
        destination,
        destinationLocation: destinationCoords,
      })
      setBooking(data.data.booking)
      toast.success('Booking sent to available government and private drivers')
    } catch (error) { toast.error(error.response?.data?.message || 'Could not submit the ambulance booking') }
    finally { setSubmitting(false) }
  }

  const locationMessage = {
    locating: 'Finding your live GPS address…', ready: 'Pickup address detected from your GPS location.',
    coordinates: 'GPS is ready; using coordinates because address lookup did not return an address.',
    'insecure-context': 'Android Chrome blocks GPS on this HTTP address. Open the site over HTTPS or localhost and allow location access.',
    unsupported: 'This browser does not support GPS.', permission: 'Allow location access in Android Chrome settings, then retry.',
    timeout: 'GPS timed out. Turn on Location on your phone and retry.', unavailable: 'Could not get a GPS fix. Turn on Location and allow access, then retry.',
  }[locationState]

  return <MobileAppShell>
    <Link to="/app" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-600"><ArrowLeft size={16} /> Back to home</Link>
    <p className="text-xs font-bold uppercase tracking-[.18em] text-red-600">Private ambulance booking</p>
    <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Plan your journey</h1>
    <p className="mt-2 text-sm leading-5 text-slate-500">Choose the right level of care for a safe trip.</p>
    <div className="mt-5 flex items-center gap-2 text-[11px] font-bold"><span className="rounded-full bg-slate-950 px-3 py-2 text-white">01 Select care</span><span className="h-px flex-1 bg-slate-200" /><span className={`rounded-full px-3 py-2 ${step === 2 ? 'bg-slate-950 text-white' : 'bg-slate-200 text-slate-500'}`}>02 Trip details</span></div>
    {booking ? <section className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Request sent</p><h2 className="mt-2 font-display text-xl font-bold">Your ambulance booking is saved</h2><p className="mt-2 text-sm text-emerald-900">You can follow driver assignment and ambulance location from your Activity page.</p><p className="mt-3 text-xs text-emerald-800">Booking {String(booking._id).slice(-8)} · {booking.status}</p><Link to="/app/activity" className="mt-4 inline-flex rounded-xl bg-emerald-800 px-4 py-3 text-sm font-bold text-white">Track this booking</Link></section> : step === 1 ? <>
      <div className="mt-5 space-y-3">{tiers.map(({ name, description, price, icon: Icon, color, features }) => <button key={name} onClick={() => setSelected(name)} className={`mobile-booking-tier ${selected === name ? 'selected' : ''} tier-${color}`}><div className="flex items-start justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-white/80"><Icon size={20} /></span>{selected === name && <span className="grid h-6 w-6 place-items-center rounded-full bg-slate-950 text-white"><Check size={14} /></span>}</div><h2 className="mt-4 text-left font-display text-lg font-bold">{name}</h2><p className="mt-1 text-left text-xs leading-5 opacity-75">{description}</p><div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-left text-[11px] font-medium opacity-80">{features.map(feature => <span key={feature} className="flex items-center gap-1"><ShieldCheck size={12} /> {feature}</span>)}</div><p className="mt-4 text-left text-sm font-bold">{price}</p></button>)}</div>
      <button disabled={!selected} onClick={() => setStep(2)} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 py-3.5 text-sm font-bold text-white disabled:opacity-40">Continue <ArrowRight size={17} /></button>
    </> : <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-5 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-red-100 text-red-600"><ShieldCheck size={20} /></span><div><p className="text-xs text-slate-500">Selected service · {tiers.find(tier => tier.name === selected)?.price}</p><h2 className="font-bold">{selected}</h2></div></div>
      <p className="-mt-3 mb-4 text-xs text-slate-500">Fare is charged per kilometre based on the trip distance.</p>
      <label className="block text-sm font-semibold">Pickup location<input value={pickup} onChange={event => { setPickup(event.target.value); setPickupCoords(null) }} placeholder="Finding your current location…" className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-red-500" /></label>
      <div className="mt-2 flex items-start gap-2 text-xs text-slate-500"><span className="flex-1">{locationMessage || 'Your pickup point will be detected when you continue.'}{pickupCoords && <span className="block">GPS: {pickupCoords.lat.toFixed(5)}, {pickupCoords.lng.toFixed(5)}</span>}</span><button type="button" onClick={retryLocation} className="shrink-0 font-bold text-red-600">Use my location</button></div>
      <label className="mt-4 block text-sm font-semibold">Drop-off location<input value={destination} onChange={event => { setDestination(event.target.value); setDestinationCoords(null); setDestinationResults([]) }} placeholder="Hospital or destination" className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-red-500" /></label>
      <button type="button" disabled={searchingDestination || destination.trim().length < 3} onClick={searchDestination} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 py-2.5 text-xs font-bold text-slate-700 disabled:opacity-50">{searchingDestination ? <LoaderCircle className="animate-spin" size={15} /> : <Search size={15} />} Find drop-off on map</button>
      {destinationResults.length > 0 && <div className="mt-2 max-h-48 space-y-2 overflow-y-auto">{destinationResults.map(result => <button key={`${result.lat}-${result.lng}`} type="button" onClick={() => { setDestination(result.displayName); setDestinationCoords({ lat: Number(result.lat), lng: Number(result.lng), source: 'user-selected' }); setDestinationResults([]) }} className="flex w-full items-start gap-2 rounded-xl bg-slate-50 p-3 text-left text-xs leading-5 hover:bg-red-50"><MapPin size={15} className="mt-0.5 shrink-0 text-red-600" />{result.displayName}</button>)}</div>}
      {destinationCoords && <p className="mt-2 text-xs font-medium text-emerald-700">Drop-off map location selected · {destinationCoords.lat.toFixed(5)}, {destinationCoords.lng.toFixed(5)}</p>}
      <div className="mt-5 flex gap-2"><button onClick={() => setStep(1)} className="flex-1 rounded-xl border border-slate-300 bg-white py-3 text-sm font-bold">Back</button><button disabled={!pickupCoords || !destinationCoords || submitting} onClick={requestAmbulance} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 py-3 text-sm font-bold text-white disabled:opacity-50">{submitting ? 'Sending…' : 'Request ambulance'}</button></div>
    </div>}
  </MobileAppShell>
}
