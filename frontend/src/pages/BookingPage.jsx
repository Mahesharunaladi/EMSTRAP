import { Ambulance, ArrowLeft, ArrowRight, Baby, Check, HeartPulse, LoaderCircle, MapPin, Search, Scale, ShieldCheck } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
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
    icon: Scale,
    color: 'amber',
    features: ['Ventilator & defibrillator', 'Critical care doctor onboard', 'Cardiac monitoring']
  },
  {
    name: 'Bariatric / Custom Transport',
    tier: 'SPECIAL',
    description: 'Specialized bariatric ramp, oxygen manifold & heavy-duty transport.',
    baseFare: 600,
    perKmRate: 45,
    icon: HeartPulse,
    color: 'purple',
    features: ['High-capacity ramp & lift', 'Continuous oxygen flow', 'Multi-paramedic team']
  },
]

const coordinatesLabel = point => `${Number(point.lat).toFixed(6)}, ${Number(point.lng).toFixed(6)}`

export default function BookingPage() {
  const [searchParams] = useSearchParams()
  const { currentLocation } = useAuth()
  const [selectedTier, setSelectedTier] = useState(() => tiers[0].tier)
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

  const searchDestination = async () => {
    if (!destination.trim() || destination.trim().length < 3) return
    setSearchingDestination(true)
    try {
      const { data } = await api.get('/location/search', { params: { query: destination.trim() } })
      setDestinationResults(data?.data?.results || [])
      if (!data?.data?.results?.length) toast('No matching hospitals or landmarks found. Try another search term.')
    } catch {
      toast.error('Unable to search destinations right now.')
    } finally {
      setSearchingDestination(false)
    }
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
      setBooking(data.data.booking)
      toast.success('Ambulance requested! Available private operators notified.')
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to book ambulance right now.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <MobileAppShell>
      <div className="flex items-center gap-3">
        <Link to="/app" className="grid h-10 w-10 place-items-center rounded-full border border-slate-300 bg-white shadow-sm">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-blue-700">Non-emergency transport</p>
          <h1 className="font-display text-2xl font-bold tracking-tight">Book an ambulance</h1>
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

          <div className="space-y-3">
            {tiers.map(t => {
              const Icon = t.icon
              const isSelected = selectedTier === t.tier
              const dynamicPrice = Math.round(t.baseFare + (distanceKm * t.perKmRate))

              return (
                <button
                  key={t.tier}
                  onClick={() => setSelectedTier(t.tier)}
                  className={`w-full rounded-2xl border-2 p-4 text-left transition ${isSelected ? 'border-slate-950 bg-white shadow-md' : 'border-slate-200 bg-white/70 hover:border-slate-300'}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="grid h-11 w-11 place-items-center rounded-xl bg-slate-100 text-slate-800">
                        <Icon size={22} />
                      </span>
                      <div>
                        <h3 className="font-display text-base font-bold text-slate-900">{t.name}</h3>
                        <p className="text-[11px] text-slate-500 mt-0.5">Base ₹{t.baseFare} + ₹{t.perKmRate}/km</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-lg font-black text-slate-950">₹{dynamicPrice}</p>
                      <p className="text-[10px] text-slate-400">Fixed trip fare</p>
                    </div>
                  </div>

                  <p className="mt-2 text-xs text-slate-600 leading-relaxed">{t.description}</p>

                  <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-600 font-medium">
                    {t.features.map((feat, idx) => (
                      <span key={idx} className="rounded-md bg-slate-100 px-2 py-0.5 flex items-center gap-1">
                        <ShieldCheck size={11} className="text-emerald-600" /> {feat}
                      </span>
                    ))}
                  </div>
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
