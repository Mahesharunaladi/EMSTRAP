import {
  Ambulance,
  ArrowLeft,
  Clock,
  MapPin,
  MessageSquare,
  Navigation,
  PhoneCall,
  RefreshCw,
  Send,
  ShieldCheck
} from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../services/api'
import {
  joinBookingRoom,
  joinUserRoom,
  onBookingChatMessage,
  onBookingDriverAssigned,
  onBookingDriverCancelled,
  onBookingDriverLocationUpdated,
  onBookingStatusUpdated
} from '../../services/emergencySocket'
import { normalizeCoords } from '../../utils/geoUtils'
import { calculateEta } from '../../utils/etaCalculator'

const TIER_LABELS = {
  STANDARD: 'Standard Transport',
  PREGNANCY: 'Maternity Support',
  ICU: 'ICU / Advanced Life Support',
  SPECIAL: 'Oxygen'
}

export default function ActiveBookingPage() {
  const { bookingId } = useParams()
  const navigate = useNavigate()

  const [booking, setBooking] = useState(null)
  const [driver, setDriver] = useState(null)
  const [driverLocation, setDriverLocation] = useState(null)
  const [messages, setMessages] = useState([])
  const [chatText, setChatText] = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)
  const [loading, setLoading] = useState(true)

  const mapContainerRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef([])
  const chatEndRef = useRef(null)

  const fetchBooking = useCallback(async () => {
    try {
      const { data } = await api.get(`/bookings/${bookingId}`)
      const b = data?.data?.booking
      if (b) {
        setBooking(b)
        setMessages(b.messages || [])
        if (b.driver) {
          setDriver(b.driver)
        }
        const loc = normalizeCoords(b.driverLocation || b.driver?.currentLocation)
        if (loc) setDriverLocation(loc)
      }
    } catch (err) {
      console.warn('Could not load booking details:', err.message)
    } finally {
      setLoading(false)
    }
  }, [bookingId])

  useEffect(() => {
    fetchBooking()
    const interval = setInterval(fetchBooking, 8000)
    return () => clearInterval(interval)
  }, [fetchBooking])

  // Socket listeners for live booking updates & real-time chat
  useEffect(() => {
    if (!bookingId) return
    const unsubRoom = joinBookingRoom(bookingId)
    const unsubUserRoom = joinUserRoom(booking?.authUserId || 'guest', null)

    const unsubAssigned = onBookingDriverAssigned(payload => {
      if (String(payload?.booking?._id) === String(bookingId)) {
        setBooking(prev => ({ ...(prev || {}), ...payload.booking }))
        if (payload.driver) setDriver(payload.driver)
        toast.success('Private Ambulance Driver accepted your booking!')
      }
    })

    const unsubLoc = onBookingDriverLocationUpdated(payload => {
      if (String(payload?.bookingId) === String(bookingId) && payload?.location) {
        const norm = normalizeCoords(payload.location)
        if (norm) setDriverLocation(norm)
      }
    })

    const unsubStatus = onBookingStatusUpdated(payload => {
      if (String(payload?._id) === String(bookingId)) {
        setBooking(prev => ({ ...(prev || {}), ...payload }))
      }
    })

    const unsubCancelled = onBookingDriverCancelled(payload => {
      if (String(payload?.bookingId) === String(bookingId)) {
        setDriver(null)
        setDriverLocation(null)
        if (payload.booking) setBooking(payload.booking)
        toast(payload.message || 'Driver cancelled — searching for another nearby ambulance...', {
          icon: '🔄',
          duration: 6000
        })
      }
    })

    const unsubChat = onBookingChatMessage(payload => {
      if (String(payload?.bookingId) === String(bookingId)) {
        if (Array.isArray(payload.messages)) {
          setMessages(payload.messages)
        } else if (payload.message) {
          setMessages(prev => [...prev, payload.message])
        }
      }
    })

    return () => {
      unsubRoom()
      unsubUserRoom()
      unsubAssigned()
      unsubLoc()
      unsubStatus()
      unsubCancelled()
      unsubChat()
    }
  }, [bookingId, booking?.authUserId])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  // Render Leaflet Live Map with Pickup, Drop-off & Moving Driver Pin
  const pickupCoords = useMemo(() => normalizeCoords(booking?.pickupLocation), [booking?.pickupLocation])
  const dropCoords = useMemo(() => normalizeCoords(booking?.destinationLocation), [booking?.destinationLocation])
  const validDriverCoords = useMemo(() => normalizeCoords(driverLocation), [driverLocation])

  useEffect(() => {
    if (!mapContainerRef.current) return

    const defaultLat = validDriverCoords?.lat || pickupCoords?.lat || dropCoords?.lat || 12.9716
    const defaultLng = validDriverCoords?.lng || pickupCoords?.lng || dropCoords?.lng || 77.5946

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [defaultLat, defaultLng],
        zoom: 13,
        zoomControl: true,
        attributionControl: false
      })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        subdomains: ['a', 'b', 'c']
      }).addTo(map)
      mapInstanceRef.current = map
    }

    const map = mapInstanceRef.current
    map.invalidateSize()
    const timer = setTimeout(() => {
      if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize()
    }, 250)

    markersRef.current.forEach(m => m.remove())
    markersRef.current = []
    const bounds = []

    if (pickupCoords) {
      const pIcon = L.divIcon({
        className: 'custom-pickup-pin',
        html: '<div style="background:#10b981;width:28px;height:28px;border-radius:50%;border:3px solid #fff;box-shadow:0 3px 10px rgba(16,185,129,.5);display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:bold;">P</div>',
        iconSize: [28, 28],
        iconAnchor: [14, 28]
      })
      markersRef.current.push(L.marker([pickupCoords.lat, pickupCoords.lng], { icon: pIcon }).addTo(map).bindPopup('<b>Pickup</b>'))
      bounds.push([pickupCoords.lat, pickupCoords.lng])
    }

    if (dropCoords) {
      const dIcon = L.divIcon({
        className: 'custom-drop-pin',
        html: '<div style="background:#ef4444;width:28px;height:28px;border-radius:50%;border:3px solid #fff;box-shadow:0 3px 10px rgba(239,68,68,.5);display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:bold;">D</div>',
        iconSize: [28, 28],
        iconAnchor: [14, 28]
      })
      markersRef.current.push(L.marker([dropCoords.lat, dropCoords.lng], { icon: dIcon }).addTo(map).bindPopup('<b>Drop-off</b>'))
      bounds.push([dropCoords.lat, dropCoords.lng])
    }

    if (validDriverCoords) {
      const drvIcon = L.divIcon({
        className: 'custom-driver-pin',
        html: '<div style="background:#2563eb;width:34px;height:34px;border-radius:50%;border:3px solid #fff;box-shadow:0 4px 12px rgba(37,99,235,.6);display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px;">🚑</div>',
        iconSize: [34, 34],
        iconAnchor: [17, 34]
      })
      markersRef.current.push(L.marker([validDriverCoords.lat, validDriverCoords.lng], { icon: drvIcon }).addTo(map).bindPopup('<b>Private Ambulance</b>'))
      bounds.push([validDriverCoords.lat, validDriverCoords.lng])
    }

    if (pickupCoords && dropCoords) {
      markersRef.current.push(L.polyline([[pickupCoords.lat, pickupCoords.lng], [dropCoords.lat, dropCoords.lng]], {
        color: '#64748b',
        weight: 2.5,
        dashArray: '5, 6',
        opacity: 0.7
      }).addTo(map))
    }

    if (validDriverCoords && pickupCoords) {
      markersRef.current.push(L.polyline([[validDriverCoords.lat, validDriverCoords.lng], [pickupCoords.lat, pickupCoords.lng]], {
        color: '#2563eb',
        weight: 3.5,
        opacity: 0.9
      }).addTo(map))
    }

    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [32, 32], maxZoom: 15 })
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 14)
    }

    return () => clearTimeout(timer)
  }, [pickupCoords, dropCoords, validDriverCoords])

  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  const eta = useMemo(() => {
    const target = booking?.status === 'STARTED' ? dropCoords : pickupCoords
    if (validDriverCoords && target && ['ACCEPTED', 'ON_THE_WAY', 'STARTED', 'ARRIVED'].includes(booking?.status)) {
      return calculateEta(validDriverCoords, target, 35)
    }
    return null
  }, [validDriverCoords, pickupCoords, dropCoords, booking?.status])

  const handleSendMessage = async (e) => {
    e.preventDefault()
    const trimmed = chatText.trim()
    if (!trimmed) return
    setSendingMsg(true)
    try {
      const { data } = await api.post(`/bookings/${bookingId}/message`, { text: trimmed })
      if (Array.isArray(data?.data?.messages)) {
        setMessages(data.data.messages)
      }
      setChatText('')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send message')
    } finally {
      setSendingMsg(false)
    }
  }

  const statusLabel = {
    PENDING: 'Finding Ambulance',
    FINDING_AMBULANCE: 'Finding Ambulance',
    ACCEPTED: 'Ambulance Accepted',
    ON_THE_WAY: 'On The Way',
    ARRIVED: 'Arrived At Pickup',
    STARTED: 'Trip In Progress',
    COMPLETED: 'Trip Completed',
    CANCELLED: 'Cancelled',
    CANCELLED_BY_DRIVER: 'Re-assigning Driver'
  }[booking?.status] || booking?.status || 'Connecting...'

  return (
    <div className="min-h-screen bg-[#f7f7f5] text-slate-900 pb-20">
      <header className="sticky top-0 z-30 border-b border-blue-200 bg-white/95 px-4 py-3.5 pt-safe backdrop-blur-md">
        <div className="mx-auto flex max-w-xl items-center justify-between">
          <button
            onClick={() => navigate('/app')}
            className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200"
          >
            <ArrowLeft size={15} /> Home
          </button>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-600 animate-pulse" />
            <span className="font-display text-sm font-bold uppercase tracking-wider text-blue-700">
              Booking #{String(bookingId).slice(-6)}
            </span>
          </div>
          <button
            onClick={fetchBooking}
            title="Refresh Booking"
            className="grid h-8 w-8 place-items-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 pt-5 space-y-5">
        {/* Status & ETA Banner */}
        <section className="rounded-3xl border-2 border-blue-400 bg-gradient-to-br from-blue-600 to-indigo-700 p-5 text-white shadow-xl shadow-blue-600/20">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/20 text-white backdrop-blur-sm">
                <Ambulance size={26} />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white/25 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                    {statusLabel}
                  </span>
                  {booking?.tier && (
                    <span className="rounded-full bg-slate-950/30 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                      {TIER_LABELS[booking.tier] || booking.tier}
                    </span>
                  )}
                </div>
                <h1 className="mt-1 font-display text-xl font-bold leading-tight">
                  {driver ? `${driver.name} is assigned` : 'Notifying nearby private drivers...'}
                </h1>
              </div>
            </div>
            {(booking?.price || booking?.estimatedFare) && (
              <div className="text-right shrink-0">
                <p className="font-display text-2xl font-black">₹{booking.price || booking.estimatedFare}</p>
                <p className="text-[10px] text-blue-100 uppercase font-bold">{booking.distanceKm || '—'} km</p>
              </div>
            )}
          </div>

          {eta && (
            <div className="mt-4 flex items-center justify-between rounded-2xl bg-white/15 px-4 py-2.5 backdrop-blur-xs">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-amber-300" />
                <span className="text-xs font-bold">Estimated Arrival: {eta.badgeText}</span>
              </div>
              <span className="rounded-lg bg-emerald-500 px-2.5 py-0.5 text-[11px] font-black text-white">
                {eta.text}
              </span>
            </div>
          )}
        </section>

        {/* Live Tracking Map */}
        <section className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Navigation size={14} className="text-blue-600" /> Live Ambulance Radar
            </h2>
            {validDriverCoords && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" /> GPS Active
              </span>
            )}
          </div>
          <div className="relative h-[240px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 z-0">
            <div ref={mapContainerRef} className="h-full w-full relative z-0" />
          </div>
          <div className="mt-3 space-y-1.5 px-1 text-xs text-slate-600">
            <p className="flex items-start gap-2">
              <MapPin size={14} className="mt-0.5 shrink-0 text-emerald-600" />
              <span><b>Pickup:</b> {booking?.pickup || 'Loading...'}</span>
            </p>
            <p className="flex items-start gap-2">
              <MapPin size={14} className="mt-0.5 shrink-0 text-red-600" />
              <span><b>Drop-off:</b> {booking?.destination || 'Loading...'}</span>
            </p>
          </div>
        </section>

        {/* Driver Contact Card */}
        {driver && (
          <section className="flex items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
              {driver.photo ? (
                <img src={driver.photo} alt={driver.name} className="h-12 w-12 rounded-2xl object-cover border border-slate-200" />
              ) : (
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-100 text-blue-700">
                  <Ambulance size={22} />
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-sm font-bold text-slate-900">{driver.name}</p>
                  <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
                </div>
                <p className="text-xs text-slate-500">
                  {driver.vehicleNumber ? `Vehicle: ${driver.vehicleNumber} · ` : ''}{driver.phone || 'Verified Private Unit'}
                </p>
              </div>
            </div>
            {driver.phone && (
              <a
                href={`tel:${driver.phone}`}
                className="flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700"
              >
                <PhoneCall size={14} /> Call Driver
              </a>
            )}
          </section>
        )}

        {/* Real-Time In-App Chat Panel */}
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-blue-100 text-blue-700">
                <MessageSquare size={16} />
              </span>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Message Driver</h2>
                <p className="text-[11px] text-slate-500">Share landmarks or gate instructions in real time</p>
              </div>
            </div>
          </div>

          <div className="mt-3 max-h-56 space-y-2.5 overflow-y-auto px-1 py-1">
            {messages.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">
                No messages yet. Send a quick note to your driver!
              </p>
            ) : (
              messages.map((m, idx) => {
                const isMe = m.senderRole === 'USER'
                return (
                  <div key={idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-xs ${isMe ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-slate-100 text-slate-900 rounded-bl-sm'}`}>
                      <p className="font-medium leading-relaxed">{m.text}</p>
                    </div>
                    <span className="mt-0.5 px-1 text-[9px] text-slate-400">
                      {m.senderName || (isMe ? 'You' : 'Driver')} · {m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                )
              })
            )}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className="mt-3 flex items-center gap-2">
            <input
              type="text"
              value={chatText}
              onChange={e => setChatText(e.target.value)}
              placeholder="Type pickup landmark or message..."
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:border-blue-500 focus:bg-white"
            />
            <button
              type="submit"
              disabled={sendingMsg || !chatText.trim()}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-600 text-white shadow hover:bg-blue-700 disabled:opacity-50"
            >
              <Send size={16} />
            </button>
          </form>
        </section>

        <div className="pt-1 text-center">
          <Link to="/app/activity" className="text-xs font-bold text-slate-500 hover:text-slate-900">
            View all bookings in Activity →
          </Link>
        </div>
      </main>
    </div>
  )
}
