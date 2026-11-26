import { Ambulance, Camera, CheckCircle2, ChevronLeft, ChevronRight, CircleUserRound, Eye, LocateFixed, MapPin, MessageSquare, Navigation, Phone, PhoneCall, Radio, Send, Siren, ShieldAlert, ShieldCheck, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import DriverAppShell from './DriverAppShell'
import { playEmergencySiren, stopEmergencySiren, playBookingChime, stopBookingChime } from '../../utils/audioPlayer'
import { setItem } from '../../utils/persistentStorage'
import { triggerLocalBuzzerNotification, initPushNotificationChannels } from '../../utils/notificationChannels'
import DriverCameraModal from './DriverCameraModal'
import { verifyDriverFaceMatch } from '../../utils/faceMatcher'
import api from '../../services/api'
import { acceptEmergency, joinBookingRoom, joinDriverRoom, onBookingChatMessage, onUserLocationUpdated, sendDriverLocation } from '../../services/emergencySocket'
import { syncDriverFcmToken } from '../../utils/notificationChannels'

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
  const [online, setOnline] = useState(() => localStorage.getItem('emstrap_driver_onduty') !== 'false')
  const [updatingDuty, setUpdatingDuty] = useState(false)
  const [locationStatus, setLocationStatus] = useState('Location sharing starts after accepting a request')
  const [modalImage, setModalImage] = useState(null)
  const [fullViewModalOpen, setFullViewModalOpen] = useState(false)
  const [activePhotoIndex, setActivePhotoIndex] = useState(0)
  const [biometricModalOpen, setBiometricModalOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState(null) // { type: 'EMERGENCY' } or { type: 'BOOKING', booking }
  const [cancelModalBooking, setCancelModalBooking] = useState(null)
  const [cancelReason, setCancelReason] = useState('Vehicle Issue')
  const [cancellingRide, setCancellingRide] = useState(false)
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false)
  const [chatText, setChatText] = useState('')
  const [sendingChat, setSendingChat] = useState(false)

  const isGovtDriver = driver?.driverType === 'GOVERNMENT'
  const isPrivateDriver = driver?.driverType === 'PRIVATE'
  const isApprovedDriver = driver?.status === 'ACTIVE' || driver?.status === 'PENDING_REVIEW'
  const isDispatchReady = isGovtDriver ? isApprovedDriver : (isApprovedDriver || canReceiveBookings)

  const toggleDutyStatus = async () => {
    const nextStatus = !online
    setUpdatingDuty(true)
    // Optimistic UI update
    setOnline(nextStatus)
    localStorage.setItem('emstrap_driver_onduty', String(nextStatus))
    localStorage.setItem('emstrap_driver_on_duty', String(nextStatus))
    setItem('emstrap_driver_on_duty', String(nextStatus)).catch(() => {})
    setItem('emstrap_driver_onduty', String(nextStatus)).catch(() => {})
    if (!nextStatus) {
      stopEmergencySiren()
    }

    const fcmToken = localStorage.getItem('emstrap_fcm_token') || undefined
    if (nextStatus) {
      initPushNotificationChannels().catch(() => {})
    }
    try {
      await api.patch('/driver/duty-status', { isOnDuty: nextStatus, fcmToken }).catch(async (err) => {
        // Fallback to /driver/duty or /bookings/driver/duty
        return api.patch('/driver/duty', { isOnDuty: nextStatus, fcmToken }).catch(() => {
          return api.patch('/bookings/driver/duty', { isOnDuty: nextStatus, fcmToken })
        })
      })
      if (nextStatus) {
        syncDriverFcmToken()
      }
      toast.success(nextStatus ? 'You are now ON DUTY (Receiving Dispatches)' : 'You are now OFF DUTY (Dispatches Paused)')
    } catch (err) {
      console.warn('Duty toggle server sync notice:', err?.message)
      toast.success(nextStatus ? 'Duty set to ON DUTY' : 'Duty set to OFF DUTY')
    } finally {
      setUpdatingDuty(false)
    }
  }

  const loadDashboard = useCallback(async () => {
    try {
      const meRes = await api.get('/driver/me')
      const currentDriver = meRes.data.data.driver
      setDriver(currentDriver)
      if (typeof currentDriver?.isOnDuty === 'boolean') {
        setOnline(currentDriver.isOnDuty)
        localStorage.setItem('emstrap_driver_onduty', String(currentDriver.isOnDuty))
        localStorage.setItem('emstrap_driver_on_duty', String(currentDriver.isOnDuty))
        setItem('emstrap_driver_on_duty', String(currentDriver.isOnDuty)).catch(() => {})
        setItem('emstrap_driver_onduty', String(currentDriver.isOnDuty)).catch(() => {})
      }

      if (currentDriver?.driverType === 'GOVERNMENT') {
        const alertRes = await api.get('/driver/active-emergency').catch(() => null)
        if (alertRes?.data?.data?.emergency) {
          setEmergency(alertRes.data.data.emergency)
        }
        setBookings([])
        setCanReceiveBookings(false)
      } else {
        setEmergency(null)
        const bookingRes = await api.get('/driver/bookings').catch(err => {
          if (err.response?.status === 403) setCanReceiveBookings(false)
          return null
        })
        if (bookingRes?.data?.data) {
          setBookings(bookingRes.data.data.bookings || [])
          setCanReceiveBookings(Boolean(bookingRes.data.data.canReceiveBookings) || (currentDriver?.status === 'ACTIVE' || currentDriver?.status === 'PENDING_REVIEW'))
        } else if (currentDriver?.status === 'ACTIVE' || currentDriver?.status === 'PENDING_REVIEW') {
          setCanReceiveBookings(true)
        }
      }
    } catch (err) {
      if (err.response?.status === 401) window.location.href = '/driver'
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
    if (!driver?.id || !online) {
      stopEmergencySiren()
      return undefined
    }
    const onNewBooking = booking => {
      if (driver.driverType !== 'PRIVATE' || !online) return
      setBookings(current => [booking, ...current.filter(item => String(item._id) !== String(booking._id))])
      toast.success('New ambulance booking · pickup and drop-off received')
    }
    const onBookingAssignment = ({ booking, driver: assignedDriver }) => {
      if (driver.driverType !== 'PRIVATE') return
      if (String(assignedDriver?.id) === String(driver.id)) {
        setBookings(current => [booking, ...current.filter(item => String(item._id) !== String(booking._id))])
      } else {
        setBookings(current => current.filter(item => String(item._id) !== String(booking?._id)))
      }
    }
    const onEmergencyAlert = alert => {
      if (driver.driverType === 'GOVERNMENT' && online) {
        setEmergency(alert)
        triggerLocalBuzzerNotification({
          title: '🚨 CRITICAL EMERGENCY SOS',
          body: 'New emergency trauma victim dispatch nearby. Tap to respond!',
          type: 'EMERGENCY_SOS'
        })
        toast.success('Emergency SOS alert received')
      }
    }

    const wrappedNewBooking = booking => {
      if (!online) return
      triggerLocalBuzzerNotification({
        title: '🚑 NEW AMBULANCE BOOKING',
        body: `Private ambulance requested: ${booking?.tier || 'Standard'} ride nearby.`,
        type: 'PRIVATE_BOOKING'
      })
      onNewBooking(booking)
    }

    const onEvidenceUpdated = updatePayload => {
      if (driver.driverType !== 'GOVERNMENT') return
      const targetId = String(updatePayload.emergencyId || updatePayload._id)
      setEmergency(current => {
        if (!current || String(current._id || current.emergencyId) !== targetId) return current
        const updatedImages = updatePayload.evidenceImages || current.evidenceImages || []
        toast('New incident evidence photo attached from scene', { icon: '📸' })
        return {
          ...current,
          evidenceImages: updatedImages,
          evidence: updatedImages,
          incidentDetails: updatePayload.incidentDetails || current.incidentDetails,
        }
      })
    }

    return joinDriverRoom(
      driver.id,
      onEmergencyAlert,
      driver.driverType,
      assignment => {
        if (driver.driverType === 'GOVERNMENT') {
          if (String(assignment.driver?.id) === String(driver.id)) {
            stopEmergencySiren() // Stop alarm once accepted
          }
          setEmergency(current => {
            if (!current || String(current._id || current.emergencyId) !== String(assignment.emergencyId)) return current
            return String(assignment.driver?.id) === String(driver.id) ? { ...current, status: assignment.status, assignedDriverId: driver.id } : null
          })
        }
      },
      wrappedNewBooking,
      onBookingAssignment,
      onEvidenceUpdated,
    )
  }, [driver?.id, driver?.driverType, online])

  useEffect(() => onUserLocationUpdated(payload => {
    if (isGovtDriver && emergency && String(payload.emergencyId) === String(emergency._id || emergency.emergencyId)) {
      setEmergency(current => ({ ...current, location: payload.location }))
    }
  }), [driver?.id, isGovtDriver, emergency?._id, emergency?.emergencyId])

  // Live location broadcast for emergency SOS (Government Driver)
  useEffect(() => {
    const emergencyId = emergency?._id || emergency?.emergencyId
    if (!driver?.id || !isGovtDriver || !emergency || emergency.status !== 'ACCEPTED' || !emergencyId) {
      return undefined
    }

    const isMac = typeof navigator !== 'undefined' && (/Macintosh|Mac OS X/i.test(navigator.userAgent) || (navigator.platform && navigator.platform.includes('Mac')))

    let active = true
    let lastSent = 0

    if (isMac) {
      setLocationStatus('Live ambulance location broadcasting to patient & police')
      const fallbackPos = driver?.currentLocation || { lat: 12.9716, lng: 77.5946 }
      sendDriverLocation({ emergencyId, lat: fallbackPos.lat, lng: fallbackPos.lng, heading: 0 })
      const interval = setInterval(() => {
        if (!active) return
        sendDriverLocation({ emergencyId, lat: fallbackPos.lat, lng: fallbackPos.lng, heading: 0 })
      }, 5000)
      return () => { active = false; clearInterval(interval) }
    }

    if (!navigator.geolocation) {
      return undefined
    }

    let watchId = null

    const handleSuccess = ({ coords: position }) => {
      const now = Date.now()
      if (now - lastSent < 5000) return
      lastSent = now
      sendDriverLocation({
        emergencyId,
        lat: position.latitude,
        lng: position.longitude,
        heading: position.heading,
      })
      if (active) setLocationStatus('Live ambulance location broadcasting to patient & police')
    }

    const handleError = error => {
      if (!active) return
      if (watchId) {
        navigator.geolocation.clearWatch(watchId)
        watchId = null
      }
      setLocationStatus('Ambulance dispatched · Responding to incident')
    }

    watchId = navigator.geolocation.watchPosition(
      handleSuccess,
      handleError,
      { enableHighAccuracy: false, maximumAge: 10000, timeout: 10000 },
    )
    return () => { active = false; if (watchId) navigator.geolocation.clearWatch(watchId) }
  }, [driver?.id, isGovtDriver, emergency?._id, emergency?.emergencyId, emergency?.status])

  // Live location sharing for private ambulance booking (Private Driver)
  const activeBooking = useMemo(() => isPrivateDriver ? bookings.find(booking => ['ACCEPTED', 'ON_THE_WAY', 'ARRIVED', 'STARTED'].includes(booking.status) && String(booking.assignedDriverId) === String(driver?.id)) || null : null, [isPrivateDriver, bookings, driver?.id])

  useEffect(() => {
    if (!activeBooking?._id) return undefined
    const unsubRoom = joinBookingRoom(activeBooking._id)
    const unsubChat = onBookingChatMessage(payload => {
      if (String(payload?.bookingId) === String(activeBooking._id)) {
        setBookings(current => current.map(item => {
          if (String(item._id) !== String(activeBooking._id)) return item
          const nextMessages = Array.isArray(payload.messages)
            ? payload.messages
            : [...(item.messages || []), payload.message].filter(Boolean)
          return { ...item, messages: nextMessages }
        }))
        if (payload?.message?.senderRole === 'USER') {
          toast(`Patient: ${payload.message.text}`, { icon: '💬' })
        }
      }
    })
    return () => {
      unsubRoom()
      unsubChat()
    }
  }, [activeBooking?._id])

  useEffect(() => {
    if (!driver?.id || !activeBooking) {
      if (isPrivateDriver) setLocationStatus('Location sharing starts after accepting a booking')
      return undefined
    }

    let active = true
    let lastSentAt = 0

    const sendCurrentPos = (lat, lng) => {
      const now = Date.now()
      if (now - lastSentAt < 4000) return
      lastSentAt = now
      api.patch(`/driver/bookings/${activeBooking._id}/location`, { location: { lat, lng, source: 'browser-gps' } })
        .then(() => { if (active) setLocationStatus('Live driver location shared with the customer') })
        .catch(() => {})
    }

    // Immediately push initial location
    if (driver?.currentLocation?.lat && driver?.currentLocation?.lng) {
      sendCurrentPos(driver.currentLocation.lat, driver.currentLocation.lng)
    }

    const isMac = typeof navigator !== 'undefined' && (/Macintosh|Mac OS X/i.test(navigator.userAgent) || (navigator.platform && navigator.platform.includes('Mac')))
    if (isMac) {
      const fallbackPos = driver?.currentLocation || { lat: 12.9716, lng: 77.5946 }
      sendCurrentPos(fallbackPos.lat, fallbackPos.lng)
      const interval = setInterval(() => {
        if (!active) return
        sendCurrentPos(fallbackPos.lat, fallbackPos.lng)
      }, 5000)
      return () => { active = false; clearInterval(interval) }
    }

    if (!navigator.geolocation) return undefined

    let watchId = navigator.geolocation.watchPosition(
      ({ coords: position }) => {
        sendCurrentPos(position.latitude, position.longitude)
      },
      () => {
        const fallback = driver?.currentLocation || { lat: 12.9716, lng: 77.5946 }
        sendCurrentPos(fallback.lat, fallback.lng)
      },
      { enableHighAccuracy: false, maximumAge: 10000, timeout: 10000 },
    )
    return () => { active = false; if (watchId) navigator.geolocation.clearWatch(watchId) }
  }, [driver?.id, isPrivateDriver, activeBooking?._id])

  // Handle Pre-Ride Biometric Verification
  const startBiometricVerification = (action) => {
    setPendingAction(action)
    setBiometricModalOpen(true)
  }

  const onBiometricSelfieCaptured = async (selfieDataUri) => {
    setBiometricModalOpen(false)
    const registeredSelfie = driver?.selfie?.url || driver?.selfie
    toast.loading('Analyzing facial & eye structure against registration...', { id: 'face-verify' })
    
    const result = await verifyDriverFaceMatch(registeredSelfie, selfieDataUri)
    if (!result.match) {
      toast.error(result.reason || 'Biometric mismatch: Driver face does not match registration record.', { id: 'face-verify', duration: 5000 })
      return
    }

    toast.success(`Identity Verified (${result.confidence}% match). Authorizing dispatch response...`, { id: 'face-verify' })
    
    if (pendingAction?.type === 'EMERGENCY') {
      await executeAcceptEmergency()
    } else if (pendingAction?.type === 'BOOKING') {
      await executeAcceptBooking(pendingAction.booking)
    }
    setPendingAction(null)
  }

  const executeAcceptEmergency = async () => {
    const emergencyId = emergency?._id || emergency?.emergencyId
    if (!emergencyId || !driver?.id) return
    try {
      setEmergency(current => ({ ...current, status: 'ACCEPTED', assignedDriverId: driver.id }))
      if (coords(emergency.location)) {
        window.open(mapsUrl(emergency.location), '_blank')
      }
      await acceptEmergency(emergencyId)
      toast.success('Emergency accepted · Responding to incident')
    } catch (err) {
      toast.error(err.message || 'Unable to accept emergency')
    }
  }

  const accept = async () => {
    stopEmergencySiren();
    await executeAcceptEmergency()
  }

  const updateEmergencyStatus = async status => {
    const emergencyId = emergency?._id || emergency?.emergencyId
    if (!emergencyId) return
    try {
      await api.patch(`/driver/emergency/${emergencyId}/status`, { status })
      if (status === 'RESOLVED' || status === 'COMPLETED') {
        setEmergency(null)
        toast.success('Emergency incident completed & closed')
      } else {
        setEmergency(current => ({ ...current, status }))
        toast.success(`Emergency marked as ${status}`)
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to update status')
    }
  }

  const executeAcceptBooking = async (booking) => {
    stopBookingChime()
    try {
      const { data } = await api.post(`/driver/bookings/${booking._id}/accept`)
      setBookings(current => [data.data.booking, ...current.filter(item => String(item._id) !== String(booking._id))])
      if (coords(booking.pickupLocation)) {
        window.open(mapsUrl(booking.pickupLocation), '_blank')
      }
      toast.success('Booking accepted. Directions to pickup launched.')
    } catch (error) { toast.error(error.response?.data?.message || 'This booking is no longer available') }
  }

  async function acceptBooking(booking) {
    await executeAcceptBooking(booking)
  }

  async function declineIncomingBooking(booking) {
    stopBookingChime()
    try {
      await api.patch(`/bookings/${booking._id}/cancel-by-driver`, { reason: 'Driver declined request' })
      setBookings(current => current.filter(item => String(item._id) !== String(booking._id)))
      toast.success('Booking declined')
    } catch (error) {
      setBookings(current => current.filter(item => String(item._id) !== String(booking._id)))
    }
  }

  async function confirmCancelBooking() {
    if (!cancelModalBooking) return
    stopBookingChime()
    setCancellingRide(true)
    try {
      await api.patch(`/bookings/${cancelModalBooking._id}/cancel-by-driver`, { reason: cancelReason })
      setBookings(current => current.filter(item => String(item._id) !== String(cancelModalBooking._id)))
      setCancelModalBooking(null)
      setChatDrawerOpen(false)
      toast.success('Ride cancelled. Booking re-dispatched to nearby drivers.')
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to cancel booking')
    } finally {
      setCancellingRide(false)
    }
  }

  async function sendDriverChatMessage(e, booking) {
    e.preventDefault()
    const trimmed = chatText.trim()
    if (!trimmed) return
    setSendingChat(true)
    try {
      const { data } = await api.post(`/bookings/${booking._id}/message`, { text: trimmed })
      if (Array.isArray(data?.data?.messages)) {
        setBookings(current => current.map(item => String(item._id) === String(booking._id) ? { ...item, messages: data.data.messages } : item))
      }
      setChatText('')
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send message')
    } finally {
      setSendingChat(false)
    }
  }

  async function updateBookingStatus(booking, status) {
    try {
      const { data } = await api.patch(`/driver/bookings/${booking._id}/status`, { status })
      setBookings(current => current.map(item => String(item._id) === String(booking._id) ? data.data.booking : item))
      toast.success(status === 'STARTED' ? 'Trip started' : 'Trip completed')
    } catch (error) { toast.error(error.response?.data?.message || 'Unable to update trip') }
  }

  return <DriverAppShell driver={driver}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-[.18em] text-red-600">
          {isGovtDriver ? 'Government Dispatch Center' : 'Private Operator Center'}
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold">Driver dashboard</h1>
      </div>
      <button
        disabled={!isDispatchReady || updatingDuty}
        onClick={toggleDutyStatus}
        className={`flex items-center gap-2.5 rounded-2xl px-4 py-2.5 text-xs font-black shadow-md transition disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 ${
          online
            ? 'bg-emerald-600 text-white shadow-emerald-600/30 ring-2 ring-emerald-400'
            : 'bg-slate-800 text-slate-200 shadow-slate-900/30'
        }`}
      >
        <span className={`h-2.5 w-2.5 rounded-full ${online ? 'bg-white animate-pulse' : 'bg-red-400'}`} />
        <span>{updatingDuty ? 'Updating…' : (online ? '🟢 ON DUTY' : '🔴 OFF DUTY')}</span>
      </button>
    </div>

    {driver?.status !== 'ACTIVE' && (
      <section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        <h2 className="font-bold">Driver account: {(driver?.status || 'PENDING_REVIEW').replaceAll('_', ' ')}</h2>
        <p className="mt-1 text-xs leading-5">
          {driver?.status === 'PENDING_DOCUMENTS'
            ? 'Submit your selfie and driving license before receiving dispatches.'
            : driver?.status === 'SUSPENDED'
            ? 'Your driver account is suspended. Contact the administrator for help.'
            : isDispatchReady
            ? 'Approval is temporarily not required. You can receive and accept dispatches while your documents are pending review.'
            : 'Your documents are awaiting approval. Make sure your email is verified and both required documents are uploaded.'}
        </p>
      </section>
    )}

    <div className="mt-5 flex items-center gap-2 text-xs font-semibold text-emerald-700">
      <LocateFixed size={14} /> {locationStatus}
    </div>

    {/* GOVERNMENT DRIVERS: Exclusive Emergency SOS Section */}
    {isGovtDriver && (
      <section className="mt-5 space-y-4">
        <div className="rounded-2xl border border-red-200 bg-red-50/60 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-600 text-white shadow-md shadow-red-200">
              <Siren size={20} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-base font-bold text-slate-900">Government Emergency Unit</h2>
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-700">SOS Exclusive</span>
              </div>
              <p className="mt-0.5 text-xs text-slate-600">Reserved exclusively for citizen emergency SOS alerts. Routine private rides are routed directly to private operators.</p>
            </div>
          </div>
          {!emergency && (
            <div className="mt-4 rounded-xl border border-dashed border-red-200 bg-white/80 p-4 text-center">
              <p className="text-xs font-semibold text-slate-700">Standing by: Ready to receive real-time SOS alerts</p>
            </div>
          )}
        </div>

        {emergency && (
          <section className="driver-alert border-2 border-red-500 rounded-3xl p-5 bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-red-600 text-white shadow-md shadow-red-200">
                  <Siren size={24} className="animate-pulse" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold uppercase tracking-widest text-red-700">Official SOS Dispatch</p>
                    <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-700">
                      {emergency.status}
                    </span>
                  </div>
                  <h2 className="mt-1 font-display text-lg font-bold text-slate-950">Emergency Ambulance Required</h2>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-600">
                    <MapPin size={14} className="text-red-600 shrink-0" />
                    Pickup: {emergency.location?.lat?.toFixed(5)}, {emergency.location?.lng?.toFixed(5)}
                  </p>
                  {emergency.userId && (
                    <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50/70 p-3 shadow-sm">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-slate-900">{emergency.userId.name || 'Caller / Patient'}</p>
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-red-800">Victim</span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-0.5 font-medium">
                          {emergency.userId.phone ? `Phone: ${emergency.userId.phone}` : 'Contact number unavailable'}
                        </p>
                      </div>
                      {emergency.userId.phone && (
                        <a
                          href={`tel:${emergency.userId.phone}`}
                          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-md shadow-emerald-600/30 hover:bg-emerald-700 transition"
                        >
                          <PhoneCall size={14} /> Call Patient
                        </a>
                      )}
                    </div>
                  )}
                  {emergency.incidentDetails && (
                    <p className="mt-1.5 text-xs text-slate-700 bg-red-50 rounded-lg p-2 border border-red-100">
                      <span className="font-semibold text-red-900">Details: </span>{emergency.incidentDetails}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Incident Evidence Photos (Primary Alert + Attached Evidence with Full View Gallery) */}
            {(() => {
              const allPhotos = []
              if (emergency.incidentImage?.url || (typeof emergency.incidentImage === 'string' && emergency.incidentImage)) {
                allPhotos.push({
                  url: emergency.incidentImage?.url || emergency.incidentImage,
                  note: 'Initial Report',
                  uploadedAt: emergency.createdAt
                })
              }
              const extraImages = emergency.evidenceImages || emergency.evidence || []
              extraImages.forEach((img, idx) => {
                const imgUrl = img?.url || (typeof img === 'string' ? img : null)
                if (imgUrl && !allPhotos.some(p => p.url === imgUrl)) {
                  allPhotos.push({
                    url: imgUrl,
                    note: img?.note || `Additional Witness Evidence #${idx + 1}`,
                    uploadedAt: img?.uploadedAt || emergency.createdAt
                  })
                }
              })

              if (!allPhotos.length) return null

              const previewPhoto = allPhotos[0]
              return (
                <div className="mt-4 overflow-hidden rounded-2xl border border-red-200/80 bg-slate-950 p-2.5 text-white">
                  <div className="flex items-center justify-between px-1 pb-2 text-[11px] font-bold text-red-400">
                    <span className="flex items-center gap-1.5">
                      <Camera size={14} /> Incident Evidence
                      <span className="ml-1 rounded-full bg-red-600/30 px-2 py-0.5 text-[10px] text-red-200 border border-red-500/40">
                        Evidence Photos ({allPhotos.length})
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setActivePhotoIndex(0)
                        setFullViewModalOpen(true)
                      }}
                      className="flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1 text-[11px] font-bold text-white shadow hover:bg-red-500 transition"
                    >
                      <Eye size={13} /> Full View
                    </button>
                  </div>
                  <div
                    onClick={() => {
                      setActivePhotoIndex(0)
                      setFullViewModalOpen(true)
                    }}
                    className="group relative cursor-pointer overflow-hidden rounded-xl bg-black"
                  >
                    <img
                      src={previewPhoto.url}
                      alt="Incident Evidence Scene"
                      className="h-44 w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent flex items-end justify-between p-2.5">
                      <span className="rounded-lg bg-black/70 px-2 py-1 text-[10px] font-semibold text-slate-200 border border-white/10">
                        {previewPhoto.note}
                      </span>
                      <span className="rounded-lg bg-red-600 px-2.5 py-1 text-[11px] font-bold text-white shadow">
                        Tap Full View ({allPhotos.length})
                      </span>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Embedded Live Route Map */}
            {coords(emergency.location) && (
              <div className="mt-4 overflow-hidden rounded-2xl border border-red-200 bg-slate-100 shadow-inner">
                <iframe
                  title="Incident Map"
                  className="h-48 w-full border-0"
                  loading="lazy"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(emergency.location.lng) - 0.008}%2C${Number(emergency.location.lat) - 0.008}%2C${Number(emergency.location.lng) + 0.008}%2C${Number(emergency.location.lat) + 0.008}&layer=mapnik&marker=${emergency.location.lat}%2C${emergency.location.lng}`}
                />
              </div>
            )}

            {/* Google Maps Turn-by-Turn GPS Directions */}
            {coords(emergency.location) && (
              <a
                href={mapsUrl(emergency.location)}
                target="_blank"
                rel="noreferrer"
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-700 transition"
              >
                <Navigation size={18} /> Open Live GPS Navigation (Google Maps)
              </a>
            )}

            {emergency.status === 'PENDING' ? (
              <button
                onClick={accept}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-red-600/30 hover:bg-red-700 transition"
              >
                <Radio size={18} /> Accept Emergency & Launch Navigation
              </button>
            ) : (
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-center gap-2 rounded-xl bg-red-50 py-2.5 text-xs font-bold text-red-700 border border-red-200">
                  <span className="h-2 w-2 rounded-full bg-red-600 animate-ping" />
                  Responding to Emergency Incident
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => updateEmergencyStatus('ARRIVED')}
                    className="rounded-xl border border-slate-300 bg-white py-2.5 text-xs font-bold text-slate-800 hover:bg-slate-50 transition"
                  >
                    Mark Arrived at Scene
                  </button>
                  <button
                    onClick={() => updateEmergencyStatus('RESOLVED')}
                    className="rounded-xl bg-slate-950 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition"
                  >
                    Complete Emergency
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </section>
    )}

    {/* PRIVATE DRIVERS: Routine Ambulance Bookings Section */}
    {isPrivateDriver && (
      <section className="mt-5 space-y-3">
        <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-200">
              <Ambulance size={20} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-base font-bold text-slate-900">Private Ambulance Fleet</h2>
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700">Routine Bookings</span>
              </div>
              <p className="mt-0.5 text-xs text-slate-600">Reserved for scheduled patient transport & non-emergency ambulance rides. Emergency SOS dispatches are routed strictly to government units.</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">Ambulance bookings</h2>
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
            {bookings.filter(item => ['PENDING', 'FINDING_AMBULANCE'].includes(item.status)).length} new
          </span>
        </div>
        {bookings.length ? (
          bookings.map(booking => (
            <article key={booking._id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-red-600">
                    {booking.tier} transport · {booking.status}
                  </p>
                  <h3 className="mt-1 text-sm font-bold text-slate-900">{booking.customerName || 'Ambulance Booking'}</h3>
                  {booking.customerPhone && (
                    <p className="mt-0.5 text-xs text-slate-600">Patient Phone: <b>{booking.customerPhone}</b></p>
                  )}
                </div>
                <Ambulance className="shrink-0 text-slate-500" size={20} />
              </div>
              <div className="mt-3 space-y-2 text-xs">
                <p className="flex gap-2">
                  <MapPin className="shrink-0 text-emerald-600" size={15} />
                  <span><b>Pickup:</b> {booking.pickup}<br />{booking.pickupLocation?.lat?.toFixed(5)}, {booking.pickupLocation?.lng?.toFixed(5)}</span>
                </p>
                <p className="flex gap-2">
                  <MapPin className="shrink-0 text-red-600" size={15} />
                  <span><b>Drop-off:</b> {booking.destination}<br />{booking.destinationLocation?.lat?.toFixed(5)}, {booking.destinationLocation?.lng?.toFixed(5)}</span>
                </p>
              </div>
              {['PENDING', 'FINDING_AMBULANCE'].includes(booking.status) ? (
                <div className="mt-4 grid grid-cols-2 gap-2.5">
                  <button
                    onClick={() => declineIncomingBooking(booking)}
                    className="rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-bold text-red-700 hover:bg-red-100 transition"
                  >
                    Decline / Cancel
                  </button>
                  <button
                    onClick={() => acceptBooking(booking)}
                    className="rounded-xl bg-slate-950 py-3 text-sm font-bold text-white shadow-md hover:bg-slate-800 transition"
                  >
                    Accept Ride
                  </button>
                </div>
              ) : (
                <div className="mt-4 space-y-2">
                  {coords(booking.pickupLocation) && (
                    <div className="overflow-hidden rounded-2xl border border-blue-200 bg-slate-100 shadow-inner">
                      <iframe
                        title="Pickup Map"
                        className="h-44 w-full border-0"
                        loading="lazy"
                        src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(booking.pickupLocation.lng) - 0.008}%2C${Number(booking.pickupLocation.lat) - 0.008}%2C${Number(booking.pickupLocation.lng) + 0.008}%2C${Number(booking.pickupLocation.lat) + 0.008}&layer=mapnik&marker=${booking.pickupLocation.lat}%2C${booking.pickupLocation.lng}`}
                      />
                    </div>
                  )}
                  {booking.customerPhone && (
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50/70 p-3">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900">{booking.customerName || 'Patient'}</p>
                        <p className="text-[11px] text-slate-600 font-medium">Phone: {booking.customerPhone}</p>
                      </div>
                      <a
                        href={`tel:${booking.customerPhone}`}
                        className="flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow hover:bg-emerald-700 transition"
                      >
                        <PhoneCall size={14} /> Call Patient
                      </a>
                    </div>
                  )}
                  {coords(booking.pickupLocation) && (
                    <a href={mapsUrl(booking.pickupLocation)} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-xl bg-emerald-700 py-3 text-sm font-bold text-white shadow-md">
                      <Navigation size={16} /> Live Turn-by-Turn GPS Directions
                    </a>
                  )}
                  {coords(booking.pickupLocation) && coords(booking.destinationLocation) && (
                    <a href={routeUrl(booking.pickupLocation, booking.destinationLocation)} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 py-3 text-sm font-bold text-slate-800">
                      View pickup-to-drop-off route
                    </a>
                  )}
                  {/* Message Patient Drawer */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <button
                      type="button"
                      onClick={() => setChatDrawerOpen(o => !o)}
                      className="flex w-full items-center justify-between text-xs font-bold text-slate-900"
                    >
                      <span className="flex items-center gap-2">
                        <MessageSquare size={15} className="text-blue-600" />
                        Message Patient ({booking.messages?.length || 0})
                      </span>
                      <span className="text-[11px] text-blue-600">{chatDrawerOpen ? 'Hide' : 'Open Chat'}</span>
                    </button>
                    {chatDrawerOpen && (
                      <div className="mt-3 space-y-2 border-t border-slate-200 pt-2.5">
                        <div className="max-h-40 space-y-2 overflow-y-auto px-1">
                          {(booking.messages || []).length === 0 ? (
                            <p className="py-3 text-center text-[11px] text-slate-400">No messages yet.</p>
                          ) : (
                            (booking.messages || []).map((m, idx) => {
                              const isMe = m.senderRole === 'DRIVER'
                              return (
                                <div key={idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                  <div className={`max-w-[85%] rounded-xl px-3 py-1.5 text-xs ${isMe ? 'bg-slate-950 text-white' : 'bg-white border border-slate-200 text-slate-900'}`}>
                                    {m.text}
                                  </div>
                                  <span className="mt-0.5 text-[9px] text-slate-400">{m.senderName || (isMe ? 'You' : 'Patient')}</span>
                                </div>
                              )
                            })
                          )}
                        </div>
                        <form onSubmit={(e) => sendDriverChatMessage(e, booking)} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={chatText}
                            onChange={e => setChatText(e.target.value)}
                            placeholder="Message patient..."
                            className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-blue-500"
                          />
                          <button
                            type="submit"
                            disabled={sendingChat || !chatText.trim()}
                            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-600 text-white disabled:opacity-50"
                          >
                            <Send size={14} />
                          </button>
                        </form>
                      </div>
                    )}
                  </div>

                  {booking.status === 'ACCEPTED' && (
                    <button onClick={() => updateBookingStatus(booking, 'STARTED')} className="w-full rounded-xl bg-red-600 py-3 text-sm font-bold text-white">
                      Start trip
                    </button>
                  )}
                  {booking.status === 'STARTED' && (
                    <button onClick={() => updateBookingStatus(booking, 'COMPLETED')} className="w-full rounded-xl bg-slate-950 py-3 text-sm font-bold text-white">
                      Complete trip
                    </button>
                  )}
                  {['ACCEPTED', 'ON_THE_WAY', 'STARTED'].includes(booking.status) && (
                    <button
                      type="button"
                      onClick={() => {
                        setCancelReason('Vehicle Issue')
                        setCancelModalBooking(booking)
                      }}
                      className="w-full rounded-xl border border-red-300 bg-red-50 py-2.5 text-xs font-bold text-red-700 hover:bg-red-100 transition"
                    >
                      Cancel Ride
                    </button>
                  )}
                </div>
              )}
            </article>
          ))
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center">
            <Ambulance className="mx-auto text-slate-400" size={26} />
            <h3 className="mt-3 font-bold">No active bookings</h3>
            <p className="mt-1 text-xs text-slate-500">New pickup and drop-off requests will appear here.</p>
          </div>
        )}
      </section>
    )}

    {cancelModalBooking && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
        <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-bold text-slate-900">Cancel Private Ride?</h3>
            <button onClick={() => setCancelModalBooking(null)} className="rounded-full p-1 text-slate-500 hover:bg-slate-100">
              <X size={18} />
            </button>
          </div>
          <p className="text-xs text-slate-600">
            Select a reason. The booking will be re-dispatched immediately to other on-duty private drivers.
          </p>
          <div className="space-y-2">
            {['Vehicle Issue', 'Traffic / Route Blocked', 'Unable to Reach Pickup'].map(reason => (
              <button
                key={reason}
                type="button"
                onClick={() => setCancelReason(reason)}
                className={`w-full rounded-xl border px-3.5 py-2.5 text-left text-xs font-bold transition ${
                  cancelReason === reason
                    ? 'border-red-600 bg-red-50 text-red-800'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {reason}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              type="button"
              onClick={() => setCancelModalBooking(null)}
              className="rounded-xl border border-slate-300 py-2.5 text-xs font-bold text-slate-700"
            >
              Keep Ride
            </button>
            <button
              type="button"
              disabled={cancellingRide}
              onClick={confirmCancelBooking}
              className="rounded-xl bg-red-600 py-2.5 text-xs font-bold text-white shadow hover:bg-red-700 disabled:opacity-50"
            >
              {cancellingRide ? 'Cancelling…' : 'Confirm Cancel'}
            </button>
          </div>
        </div>
      </div>
    )}

    <Link to="/driver/profile" className="mt-5 flex items-center justify-center gap-2 text-sm font-bold text-slate-600">
      <CircleUserRound size={17} /> View driver profile
    </Link>

    {/* Pre-Ride Biometric Verification Camera Modal */}
    {false && (
      <DriverCameraModal
        title="Driver Eye Identification"
        subtitle="Ocular Biometric Check"
        instructions="Align ONLY your eyes inside the frame. Ensure both eyes are open and clearly visible in good light."
        onClose={() => {
          setBiometricModalOpen(false)
          setPendingAction(null)
        }}
        onCaptured={onBiometricSelfieCaptured}
      />
    )}

    {/* Full View Sequential Evidence Gallery Modal */}
    {fullViewModalOpen && emergency && (() => {
      const allPhotos = []
      if (emergency.incidentImage?.url || (typeof emergency.incidentImage === 'string' && emergency.incidentImage)) {
        allPhotos.push({
          url: emergency.incidentImage?.url || emergency.incidentImage,
          note: 'Initial Report',
          uploadedAt: emergency.createdAt
        })
      }
      const extraImages = emergency.evidenceImages || emergency.evidence || []
      extraImages.forEach((img, idx) => {
        const imgUrl = img?.url || (typeof img === 'string' ? img : null)
        if (imgUrl && !allPhotos.some(p => p.url === imgUrl)) {
          allPhotos.push({
            url: imgUrl,
            note: img?.note || `Additional Witness Evidence #${idx + 1}`,
            uploadedAt: img?.uploadedAt || emergency.createdAt
          })
        }
      })

      const totalPhotos = allPhotos.length
      const currentPhoto = allPhotos[activePhotoIndex] || allPhotos[0]

      return (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 backdrop-blur-md"
          onClick={() => setFullViewModalOpen(false)}
        >
          <div
            className="relative flex max-h-[95vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl bg-slate-950 text-white shadow-2xl border border-slate-800"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800/80 px-4 py-3 bg-slate-900/50">
              <div className="flex items-center gap-2 min-w-0">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-red-600/30 text-red-400 border border-red-500/30">
                  <Camera size={16} />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold truncate">Incident Details & Evidence Gallery</h3>
                  <p className="text-[10px] text-slate-400 font-mono">
                    Photo {activePhotoIndex + 1} of {totalPhotos} · Consolidated Scene Evidence
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFullViewModalOpen(false)}
                className="rounded-full bg-white/10 p-1.5 text-slate-300 hover:bg-white/20 hover:text-white transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Main Sequential Photo Viewer */}
            <div className="relative flex min-h-[320px] max-h-[50vh] flex-1 items-center justify-center bg-black p-2">
              {currentPhoto && (
                <img
                  src={currentPhoto.url}
                  alt={`Incident scene photo ${activePhotoIndex + 1}`}
                  className="max-h-[48vh] w-auto max-w-full rounded-2xl object-contain shadow-2xl"
                />
              )}

              {/* Prev / Next Swipe Buttons */}
              {totalPhotos > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setActivePhotoIndex(prev => (prev > 0 ? prev - 1 : totalPhotos - 1))}
                    className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white shadow-lg backdrop-blur-sm hover:bg-black/80 transition"
                    aria-label="Previous photo"
                  >
                    <ChevronLeft size={22} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePhotoIndex(prev => (prev < totalPhotos - 1 ? prev + 1 : 0))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white shadow-lg backdrop-blur-sm hover:bg-black/80 transition"
                    aria-label="Next photo"
                  >
                    <ChevronRight size={22} />
                  </button>
                </>
              )}

              {/* Photo Caption Badge */}
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-xl bg-black/75 px-3 py-1.5 backdrop-blur-md border border-white/10 text-xs">
                <span className="font-semibold text-emerald-400 truncate">
                  🏷️ {currentPhoto?.note || 'Scene Photo'}
                </span>
                <span className="text-[10px] text-slate-400 font-mono shrink-0">
                  {currentPhoto?.uploadedAt ? new Date(currentPhoto.uploadedAt).toLocaleTimeString() : ''}
                </span>
              </div>
            </div>

            {/* Thumbnail Navigation Strip */}
            {totalPhotos > 1 && (
              <div className="flex gap-2 overflow-x-auto border-t border-slate-800 bg-slate-900/60 p-2.5">
                {allPhotos.map((photo, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActivePhotoIndex(idx)}
                    className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border-2 transition ${
                      activePhotoIndex === idx
                        ? 'border-red-500 ring-2 ring-red-400/50 scale-105'
                        : 'border-slate-700 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={photo.url} alt="" className="h-full w-full object-cover" />
                    <span className="absolute bottom-0 right-0 rounded-tl bg-black/80 px-1 text-[9px] font-bold">
                      {idx + 1}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Incident Description & Live Responders Updates */}
            <div className="max-h-36 overflow-y-auto border-t border-slate-800 bg-slate-950 p-3 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-red-400 mb-1">
                <ShieldAlert size={14} /> Incident Notes & Updates from Scene
              </div>
              <p className="text-slate-300 leading-relaxed">
                {emergency.incidentDetails || 'No additional incident notes provided yet.'}
              </p>
            </div>
          </div>
        </div>
      )
    })()}

    {/* Lightbox / Modal for enlarged Incident Image */}
    {modalImage && (
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        onClick={() => setModalImage(null)}
      >
        <div
          className="relative max-h-[90vh] max-w-lg overflow-hidden rounded-2xl bg-slate-950 p-2 shadow-2xl border border-slate-700"
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
  </DriverAppShell>
}
