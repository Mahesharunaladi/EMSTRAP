import BookingMapPicker from '../components/BookingMapPicker'
import { Ambulance, ArrowLeft, ArrowRight, Baby, Check, HeartPulse, LoaderCircle, MapPin, Search, ShieldCheck, Wind } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import MobileAppShell from '../components/MobileAppShell'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import { calculateEta } from '../utils/etaCalculator'

/**
 * Distance-Based Dynamic Fare Rates:
 * 1. Standard Transport (STANDARD): Base ₹250 + ₹25/km
 * 2. Maternity Support (PREGNANCY): Base ₹400 + ₹35/km
 * 3. ICU / Advanced Life Support (ICU): Base ₹800 + ₹60/km
 * 4. Bariatric / Custom (SPECIAL): Base ₹600 + ₹45/km
 */
const tiers = [
  {
    name: 'Standard Transport',
    tier: 'STANDARD',
    description: 'Comfortable patient transport with essential first-aid kit.',
    baseFare: 250,
    perKmRate: 25,
    icon: Ambulance,
    color: 'blue',
    features: ['Basic first-aid kit', 'Patient stretcher', 'Certified paramedic']
  },
  {
    name: 'Maternity Support',
    tier: 'PREGNANCY',
    description: 'Specialized neonatal & maternal ambulance with hospital coordination.',
    baseFare: 400,
    perKmRate: 35,
    icon: Baby,
    color: 'pink',
    features: ['Pregnancy-trained crew', 'Neonatal emergency kit', 'Priority hospital route']
  },
  {
    name: 'ICU / Advanced Life Support',
    tier: 'ICU',
    description: 'Critical care transport with ventilator & advanced monitoring systems.',
    baseFare: 800,
    perKmRate: 60,
    icon: HeartPulse,
    color: 'amber',
    features: ['Ventilator & defibrillator', 'Critical care doctor onboard', 'Cardiac monitoring']
  },
  {
    name: 'Oxygen',
    tier: 'SPECIAL',
    description: 'Transport with continuous oxygen support',
    baseFare: 600,
    perKmRate: 45,
    icon: Wind,
    color: 'purple',
    features: []
  },
]

const coordinatesLabel = point => `${Number(point.lat).toFixed(6)}, ${Number(point.lng).toFixed(6)}`

export default function BookingPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { currentLocation } = useAuth()
  const [selectedTier, setSelectedTier] = useState(() => tiers[0].tier)
  const [step, setStep] = useState(1)
  const [pickup, setPickup] = useState('')
  const [pickupCoords, setPickupCoords] = useState(null)
  const [destination, setDestination] = useState('')
  const [destinationCoords, setDestinationCoords] = useState(null)
  const [destinationResults, setDestinationResults] = useState([])
  const [activePinMode, setActivePinMode] = useState('destination')
  const [searchingDestination, setSearchingDestination] = useState(false)
  const [booking, setBooking] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [locationState, setLocationState] = useState('idle')
  const reverseLookupAttempted = useRef(false)

  const lookupAddress = useCallback(async point => {
    if (reverseLookupAttempted.current) return null
    reverseLookupAttempted.current = true
    try {
      const { data } = await api.get('/location/reverse', { params: { lat: point.lat, lng: point.lng } })
      return data?.data?.address || null
    } catch { return null }
  }, [])

  const applyPickup = useCallback(point => {
    const location = { lat: Number(point.lat), lng: Number(point.lng), source: point.source || 'user-selected' }
    setPickupCoords(location)
    const coordinates = coordinatesLabel(location)
    if (point.address) {
      setPickup(point.address)
      setLocationState('ready')
      return
    }
    setPickup(coordinates)
    setLocationState('locating')
    lookupAddress(location).then(address => {
      setPickup(address || coordinates)
      setLocationState(address ? 'ready' : 'coordinates')
      api.patch('/auth/location', { ...location, address: address || undefined }).catch(() => {})
    })
  }, [lookupAddress])

  const locatePickup = useCallback(() => {
    if (currentLocation && Number.isFinite(Number(currentLocation.lat)) && Number.isFinite(Number(currentLocation.lng))) {
      applyPickup(currentLocation)
      return
    }
    setLocationState('locating')
    if (!navigator.geolocation) { setLocationState('unsupported'); return }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => applyPickup({ lat: coords.latitude, lng: coords.longitude }),
      async () => {
        try {
          const res = await fetch('https://ipwho.is/', { signal: AbortSignal.timeout(3000) })
          if (res.ok) {
            const d = await res.json()
            if (Number.isFinite(d.latitude) && Number.isFinite(d.longitude)) {
              applyPickup({ lat: Number(d.latitude), lng: Number(d.longitude) })
              return
            }
          }
        } catch (_) {}
        setLocationState('approximate')
      },
      { enableHighAccuracy: false, maximumAge: 30000, timeout: 6000 }
    )
  }, [currentLocation, applyPickup])

  useEffect(() => {
    locatePickup()
  }, [locatePickup])

  // Calculate live route distance and travel time between pickup and drop-off
  const routeCalculation = useMemo(() => {
    if (!pickupCoords || !destinationCoords) return null
    return calculateEta(pickupCoords, destinationCoords, 35) // ambulance average travel speed 35 km/h
  }, [pickupCoords, destinationCoords])

  const distanceKm = routeCalculation?.distanceKm || 2.0
  const travelMinutes = routeCalculation?.minutes || 5

  const handlePickMapLocation = useCallback(async (coords, mode) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}&zoom=18&addressdetails=1`, {
        headers: { 'Accept': 'application/json' }
      }).catch(() => null)
      const data = response ? await response.json().catch(() => null) : null
      const formattedAddress = data?.display_name || `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`

      if (mode === 'pickup') {
        setPickup(formattedAddress)
        setPickupCoords({ lat: coords.lat, lng: coords.lng, source: 'user-selected' })
      } else {
        setDestination(formattedAddress)
        setDestinationCoords({ lat: coords.lat, lng: coords.lng, source: 'user-selected' })
        setDestinationResults([])
      }
    } catch {
      if (mode === 'pickup') {
        setPickup(`${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`)
        setPickupCoords({ lat: coords.lat, lng: coords.lng, source: 'user-selected' })
      } else {
        setDestination(`${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`)
        setDestinationCoords({ lat: coords.lat, lng: coords.lng, source: 'user-selected' })
      }
    }
  }, [])

  const searchDestination = async () => {
    const term = destination.trim()
    if (!term || term.length < 2) return
    setSearchingDestination(true)
    let foundResults = []
    try {
      // 1. Try internal backend API with both q and query parameters
      const { data } = await api.get('/location/search', { params: { q: term, query: term } })
      const list = Array.isArray(data?.data) ? data.data : (data?.data?.results || [])
      if (Array.isArray(list) && list.length > 0) {
        foundResults = list
      }
    } catch (e) {
      console.warn('Backend location search failed, falling back to public geocoder:', e.message)
    }

    // 2. Direct client-side Nominatim fallback if backend returned nothing or errored
    if (!foundResults.length) {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(term)}`, {
          headers: { 'Accept-Language': 'en' },
          signal: AbortSignal.timeout(4000)
        })
        if (res.ok) {
          const osmData = await res.json()
          if (Array.isArray(osmData) && osmData.length > 0) {
            foundResults = osmData.map(item => ({
              displayName: item.display_name,
              lat: Number(item.lat),
              lng: Number(item.lon)
            })).filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng))
          }
        }
      } catch (_) {}
    }

    // 3. Fallback: if still no results, offer manual custom address with approximate offset from pickup
    if (!foundResults.length && pickupCoords) {
      // Create a helpful fallback destination based on user's entered text
      foundResults = [{
        displayName: `${term} (Custom Destination)`,
        lat: pickupCoords.lat + 0.025,
        lng: pickupCoords.lng + 0.025,
        isCustom: true
      }]
    }

    setDestinationResults(foundResults)
    setSearchingDestination(false)
  }

  const requestAmbulance = async () => {
    if (!pickupCoords || !destinationCoords) return toast.error('Choose both pickup and drop-off locations.')
    const chosenTierObj = tiers.find(t => t.tier === selectedTier) || tiers[0]
    const calculatedPrice = Math.round(chosenTierObj.baseFare + (distanceKm * chosenTierObj.perKmRate))

    setSubmitting(true)
    try {
      const { data } = await api.post('/bookings', {
        tier: chosenTierObj.tier,
        pickup,
        pickupLocation: pickupCoords,
        destination,
        destinationLocation: destinationCoords,
        distanceKm,
        estimatedFare: calculatedPrice
      })
      const created = data.data.booking
      setBooking(created)
      toast.success('Ambulance requested! Redirecting to live tracking...')
      if (created?._id) {
        navigate(`/booking/active/${created._id}`, { replace: true })
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to book ambulance right now.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <MobileAppShell>
      <div className="pt-1">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/app" className="grid h-10 w-10 place-items-center rounded-full border border-slate-300 bg-white shadow-sm hover:bg-slate-50 transition">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-[11px] font-bold uppercase tracking-[.18em] text-blue-700">Non-emergency transport</p>
                <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-blue-800 border border-blue-200">
                  Private Ambulance
                </span>
              </div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">Book an ambulance</h1>
            </div>
          </div>
        </div>
      </div>

      {booking ? (
        <section className="mt-7 rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-600 text-white shadow-lg">
            <Check size={28} />
          </div>
          <h2 className="mt-4 font-display text-2xl font-bold text-emerald-950">Ambulance Confirmed!</h2>
          <p className="mt-2 text-xs leading-5 text-emerald-900">
            Your booking request has been dispatched to private drivers. Track live GPS movement and arrival time in the Activity tab.
          </p>
          <div className="mt-4 rounded-2xl bg-white p-4 text-left border border-emerald-200 text-xs text-slate-700 space-y-1">
            <p><b>Booking ID:</b> #{String(booking._id).slice(-8)}</p>
            <p><b>Service Tier:</b> {booking.tier}</p>
            <p><b>Trip Distance:</b> {distanceKm} km</p>
            <p className="text-emerald-700 font-bold text-sm mt-1">Total Fare: ₹{booking.price || booking.estimatedFare}</p>
          </div>
          <Link to="/app/activity" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 py-3.5 text-sm font-bold text-white shadow">
            Track this booking in Activity <ArrowRight size={16} />
          </Link>
        </section>
      ) : step === 1 ? (
        /* Step 1: Destination Selection & Live Distance Calculator */
        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-blue-100 text-blue-700 font-bold text-xs">1</span>
            <h2 className="font-display text-base font-bold text-slate-900">Choose Pickup & Destination</h2>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
              Pickup Location
            </label>
            <div className="relative">
              <input
                value={pickup}
                onChange={e => { setPickup(e.target.value); setPickupCoords(null) }}
                placeholder="Detecting your location…"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-xs outline-none focus:border-blue-500"
              />
            </div>
            {pickupCoords && (
              <p className="mt-1 text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                <Check size={12} /> GPS: {pickupCoords.lat.toFixed(5)}, {pickupCoords.lng.toFixed(5)}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
              Drop-off Destination / Hospital
            </label>
            <div className="flex gap-2">
              <input
                value={destination}
                onChange={e => { setDestination(e.target.value); setDestinationCoords(null); setDestinationResults([]) }}
                placeholder="Search hospital or landmark (e.g. Apollo Hospital)"
                className="flex-1 rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-xs outline-none focus:border-blue-500"
              />
              <button
                type="button"
                disabled={searchingDestination || destination.trim().length < 3}
                onClick={searchDestination}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {searchingDestination ? <LoaderCircle className="animate-spin" size={15} /> : <Search size={15} />}
                Search
              </button>
            </div>

            {destinationResults.length > 0 && (
              <div className="mt-2 max-h-44 space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
                {destinationResults.map((result, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setDestination(result.displayName)
                      setDestinationCoords({ lat: Number(result.lat), lng: Number(result.lng), source: 'user-selected' })
                      setDestinationResults([])
                    }}
                    className="flex w-full items-start gap-2 rounded-lg bg-white p-2.5 text-left text-xs text-slate-800 shadow-sm hover:bg-blue-50"
                  >
                    <MapPin size={14} className="mt-0.5 shrink-0 text-red-600" />
                    <span className="truncate">{result.displayName}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Interactive Map Location Picker */}
            <div>
              <div className="flex items-center justify-between mt-3 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Interactive Route Map Picker
                </span>
                <span className="text-[10px] text-slate-400">
                  Tap to set pin
                </span>
              </div>
              <BookingMapPicker
                pickupCoords={pickupCoords}
                destinationCoords={destinationCoords}
                activeMode={activePinMode}
                onChangeMode={setActivePinMode}
                onPickLocation={handlePickMapLocation}
              />
            </div>

            {destinationCoords && (
              <div className="mt-3 rounded-xl bg-blue-50 p-3 border border-blue-200 text-xs text-blue-900 flex items-center justify-between">
                <div>
                  <p className="font-bold">Route Calculated</p>
                  <p className="text-[11px] text-blue-700">{distanceKm} km • ~{travelMinutes} mins travel time</p>
                </div>
                <span className="rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-black text-white">
                  {distanceKm} km
                </span>
              </div>
            )}
          </div>

          <button
            disabled={!pickupCoords || !destinationCoords}
            onClick={() => setStep(2)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 py-3.5 text-sm font-bold text-white disabled:opacity-40"
          >
            Select Ambulance Tier <ArrowRight size={17} />
          </button>
        </div>
      ) : (
        /* Step 2: Dynamic Per-KM Pricing Ambulance Options */
        <div className="mt-5 space-y-4">
          <div className="flex items-center justify-between">
            <button onClick={() => setStep(1)} className="text-xs font-bold text-slate-600 flex items-center gap-1 hover:text-slate-900">
              <ArrowLeft size={14} /> Back to Route
            </button>
            <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
              Distance: {distanceKm} km (~{travelMinutes}m)
            </span>
          </div>

          <div className="space-y-3.5">
            {tiers.map(t => {
              const Icon = t.icon
              const isSelected = selectedTier === t.tier
              const dynamicPrice = Math.round(t.baseFare + (distanceKm * t.perKmRate))

              // Match exact pastel colors from Services:
              const toneStyles = {
                STANDARD: {
                  card: 'bg-blue-100/80 border-blue-200',
                  iconBox: 'bg-white text-blue-700 shadow-xs',
                  title: 'text-blue-950',
                  sub: 'text-blue-700',
                  desc: 'text-blue-900/80',
                  tag: 'bg-white/90 text-blue-900 border border-blue-200/60',
                  price: 'text-blue-950'
                },
                PREGNANCY: {
                  card: 'bg-pink-100/80 border-pink-200',
                  iconBox: 'bg-white text-pink-700 shadow-xs',
                  title: 'text-pink-950',
                  sub: 'text-pink-700',
                  desc: 'text-pink-900/80',
                  tag: 'bg-white/90 text-pink-900 border border-pink-200/60',
                  price: 'text-pink-950'
                },
                ICU: {
                  card: 'bg-amber-100/80 border-amber-200',
                  iconBox: 'bg-white text-amber-700 shadow-xs',
                  title: 'text-amber-950',
                  sub: 'text-amber-800',
                  desc: 'text-amber-900/80',
                  tag: 'bg-white/90 text-amber-900 border border-amber-200/60',
                  price: 'text-amber-950'
                },
                SPECIAL: {
                  card: 'bg-purple-100/80 border-purple-200',
                  iconBox: 'bg-white text-purple-700 shadow-xs',
                  title: 'text-purple-950',
                  sub: 'text-purple-700',
                  desc: 'text-purple-900/80',
                  tag: 'bg-white/90 text-purple-900 border border-purple-200/60',
                  price: 'text-purple-950'
                }
              }[t.tier] || {
                card: 'bg-slate-100 border-slate-200',
                iconBox: 'bg-white text-slate-800',
                title: 'text-slate-900',
                sub: 'text-slate-600',
                desc: 'text-slate-600',
                tag: 'bg-white text-slate-700',
                price: 'text-slate-900'
              }

              return (
                <button
                  key={t.tier}
                  onClick={() => setSelectedTier(t.tier)}
                  className={`w-full rounded-2xl border-2 p-4 text-left transition shadow-xs ${toneStyles.card} ${
                    isSelected ? 'ring-2 ring-slate-950 border-slate-950 shadow-md scale-[1.01]' : 'hover:border-slate-400'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`grid h-12 w-12 place-items-center rounded-2xl ${toneStyles.iconBox}`}>
                        <Icon size={24} />
                      </span>
                      <div>
                        <h3 className={`font-display text-base font-bold ${toneStyles.title}`}>{t.name}</h3>
                        <p className={`text-[11px] font-semibold ${toneStyles.sub} mt-0.5`}>Base ₹{t.baseFare} + ₹{t.perKmRate}/km</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-display text-xl font-black ${toneStyles.price}`}>₹{dynamicPrice}</p>
                      <p className="text-[10px] font-semibold text-slate-500 uppercase">Per-km rate</p>
                    </div>
                  </div>

                  <p className={`mt-2.5 text-xs ${toneStyles.desc} leading-relaxed`}>{t.description}</p>


                </button>
              )
            })}
          </div>

          <button
            disabled={submitting}
            onClick={requestAmbulance}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-red-600/30 hover:bg-red-500 disabled:opacity-50"
          >
            {submitting ? 'Dispatching…' : 'Request Ambulance Now'}
          </button>
        </div>
      )}
    </MobileAppShell>
  )
}
