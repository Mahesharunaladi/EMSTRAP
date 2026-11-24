import React, { useEffect, useState, useCallback } from 'react'
import {
  Activity,
  AlertTriangle,
  Ambulance,
  Bed,
  Bell,
  BellOff,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  HeartPulse,
  Hospital as HospitalIcon,
  LocateFixed,
  Lock,
  LogOut,
  MapPin,
  Phone,
  RefreshCw,
  ShieldCheck,
  Siren,
  Sparkles,
  Stethoscope,
  User,
  Volume2,
  VolumeX,
  X
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from './services/api'
import { joinHospitalRoom } from './services/hospitalSocket'
import { normalizeCoords } from './utils/geoUtils'
import { calculateEta } from './utils/etaCalculator'
import { playEmergencySiren, stopEmergencySiren } from './utils/audioPlayer'

export default function HospitalDashboard() {
  const [emergencies, setEmergencies] = useState([])
  const [locations, setLocations] = useState({})
  const [assignments, setAssignments] = useState({})
  const [alarmActive, setAlarmActive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState({})

  // Full-view photo gallery state
  const [fullViewModalOpen, setFullViewModalOpen] = useState(false)
  const [activeEmergencyForModal, setActiveEmergencyForModal] = useState(null)
  const [activePhotoIndex, setActivePhotoIndex] = useState(0)

  // Authentication State
  const [authenticated, setAuthenticated] = useState(() => {
    return localStorage.getItem('emstrap_hospital_session') === 'true' ||
           sessionStorage.getItem('emstrap_hospital_session') === 'true'
  })
  const [loginEmail, setLoginEmail] = useState('hospital.hq@emstrap.gov.in')
  const [loginPassword, setLoginPassword] = useState('Hospital@123')
  const [loginError, setLoginError] = useState('')

  const handleHospitalLogin = (e) => {
    e.preventDefault()
    const emailNorm = loginEmail.trim().toLowerCase()
    if (
      (emailNorm === 'hospital.hq@emstrap.gov.in' || emailNorm === 'hospital' || emailNorm === 'apollo.er@emstrap.gov.in') &&
      loginPassword === 'Hospital@123'
    ) {
      localStorage.setItem('emstrap_hospital_session', 'true')
      setAuthenticated(true)
      setLoginError('')
      toast.success('Hospital Trauma Command Authenticated')
    } else {
      setLoginError('Invalid hospital credentials. Use the demo credentials provided.')
    }
  }

  const fillDemoCredentials = () => {
    setLoginEmail('hospital.hq@emstrap.gov.in')
    setLoginPassword('Hospital@123')
    setLoginError('')
    toast.success('Filled Demo Hospital Credentials')
  }

  const handleLogout = () => {
    localStorage.removeItem('emstrap_hospital_session')
    sessionStorage.removeItem('emstrap_hospital_session')
    setAuthenticated(false)
    stopEmergencySiren()
    setAlarmActive(false)
  }

  const triggerBuzzerAlarm = (alert) => {
    setAlarmActive(true)
    playEmergencySiren(true)
  }

  const acknowledgeAlertBuzzer = () => {
    stopEmergencySiren()
    setAlarmActive(false)
    toast.success('Emergency siren acknowledged')
  }

  const fetchEmergencies = useCallback(async () => {
    try {
      setLoading(true)
      const res = await api.get('/hospital/alerts')
      const items = res.data?.data?.emergencies || res.data?.data?.alerts || []
      setEmergencies(items)
      const locMap = {}
      items.forEach(em => {
        const loc = em.driverLocation || em.assignedDriverId?.currentLocation
        if (loc) locMap[em._id] = loc
      })
      setLocations(prev => ({ ...prev, ...locMap }))
    } catch (err) {
      console.warn('Hospital fetch notice:', err?.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Socket and Polling Sync
  useEffect(() => {
    if (!authenticated) return

    fetchEmergencies()

    const onAlert = alert => {
      const alertId = String(alert.emergencyId || alert._id)
      setEmergencies(current => {
        if (current.some(item => String(item._id || item.emergencyId) === alertId)) {
          return current.map(item => String(item._id || item.emergencyId) === alertId ? { ...item, ...alert } : item)
        }
        return [
          {
            _id: alertId,
            emergencyId: alertId,
            location: alert.location,
            status: alert.status || 'PENDING',
            userId: alert.userId,
            incidentImage: alert.incidentImage,
            evidenceImages: alert.evidenceImages || (alert.incidentImage ? [alert.incidentImage] : []),
            incidentDetails: alert.incidentDetails,
            createdAt: alert.createdAt || new Date()
          },
          ...current
        ]
      })
      if (!alert.silentSync) {
        triggerBuzzerAlarm(alert)
        toast.success(`🚨 INCOMING TRAUMA ALERT #${alertId.slice(-6)}`, { duration: 6000 })
      }
    }

    const onAssignment = assignment => {
      setAssignments(current => ({ ...current, [assignment.emergencyId]: assignment.driver }))
      setEmergencies(current =>
        current.map(item =>
          String(item._id || item.emergencyId) === String(assignment.emergencyId)
            ? { ...item, status: assignment.status || 'ACCEPTED', assignedDriverId: assignment.driver }
            : item
        )
      )
    }

    const onDriverLoc = update => {
      setLocations(current => ({ ...current, [update.emergencyId]: update.location }))
    }

    const onStatusUpdated = payload => {
      setEmergencies(current =>
        current.map(item =>
          String(item._id || item.emergencyId) === String(payload.emergencyId)
            ? { ...item, ...payload.emergency, status: payload.status, hospitalStatus: payload.hospitalStatus }
            : item
        )
      )
    }

    const onEvidenceUpdated = updatePayload => {
      const targetId = String(updatePayload.emergencyId || updatePayload._id)
      setEmergencies(current =>
        current.map(item => {
          if (String(item._id || item.emergencyId) === targetId) {
            toast('New trauma scene photo uploaded', { icon: '📸' })
            return {
              ...item,
              evidenceImages: updatePayload.evidenceImages || item.evidenceImages || [],
              evidence: updatePayload.evidenceImages || item.evidence || [],
              incidentDetails: updatePayload.incidentDetails || item.incidentDetails
            }
          }
          return item
        })
      )
    }

    const cleanup = joinHospitalRoom(onAlert, onAssignment, onDriverLoc, onStatusUpdated, onEvidenceUpdated)

    // 5-second REST polling fallback
    const interval = setInterval(fetchEmergencies, 5000)

    return () => {
      cleanup()
      clearInterval(interval)
      stopEmergencySiren()
    }
  }, [authenticated, fetchEmergencies])

  const handleHospitalAction = async (emergencyId, action) => {
    try {
      setActionLoading(prev => ({ ...prev, [emergencyId]: action }))
      const res = await api.patch(`/hospital/alerts/${emergencyId}/acknowledge`, { action })
      toast.success(action === 'BED_PREPARED' ? '✅ Trauma Bed & ER Team Dispatched' : '✅ Patient Handover Confirmed')
      fetchEmergencies()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update hospital status')
    } finally {
      setActionLoading(prev => ({ ...prev, [emergencyId]: null }))
    }
  }

  // If Not Authenticated, show Login Screen with Demo Credentials Button
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />

          <div className="text-center space-y-2 mb-6">
            <div className="inline-flex p-3 bg-rose-600/20 text-rose-500 rounded-2xl border border-rose-500/30 mb-2">
              <HospitalIcon size={32} />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center justify-center gap-2">
              EmSTraP Hospital Command
            </h1>
            <p className="text-xs text-slate-400">
              Trauma Center, Emergency Room & Inbound Ambulance Portal
            </p>
          </div>

          <form onSubmit={handleHospitalLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Hospital Command Email
              </label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-rose-500 transition"
                placeholder="hospital.hq@emstrap.gov.in"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-rose-500 transition"
                placeholder="••••••••"
              />
            </div>

            {loginError && (
              <div className="p-3 bg-red-950/50 border border-red-800/80 rounded-xl text-xs text-red-300 flex items-center gap-2">
                <AlertTriangle size={16} className="shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-rose-600/30 transition flex items-center justify-center gap-2"
            >
              <Lock size={16} />
              <span>Enter Trauma Command Center</span>
            </button>

            <button
              type="button"
              onClick={fillDemoCredentials}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2.5 px-4 rounded-xl border border-slate-700 transition flex items-center justify-center gap-2 text-xs"
            >
              <Sparkles size={14} className="text-amber-400" />
              <span>Fill Demo Hospital Credentials</span>
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-800/80 text-center">
            <p className="text-[11px] text-slate-500">
              Demo: <span className="text-slate-400 font-mono">hospital.hq@emstrap.gov.in</span> · Password: <span className="text-slate-400 font-mono">Hospital@123</span>
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-rose-600/20 text-rose-500 rounded-xl border border-rose-500/30">
            <HospitalIcon size={22} />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
              EmSTraP Trauma & ER Command
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold uppercase tracking-wider">
                Live 24/7 Feed
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">Emergency Medical Services & Trauma Inbound Radar</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {alarmActive ? (
            <button
              onClick={acknowledgeAlertBuzzer}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-xl font-bold text-xs shadow-lg shadow-red-600/40 animate-pulse hover:bg-red-700 transition"
            >
              <VolumeX size={15} />
              <span>Acknowledge Siren</span>
            </button>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-slate-300 rounded-xl text-xs border border-slate-700">
              <Volume2 size={14} className="text-emerald-400" />
              <span className="hidden sm:inline">Audible Alert Ready</span>
            </span>
          )}

          <button
            onClick={fetchEmergencies}
            disabled={loading}
            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 border border-slate-700 transition"
            title="Refresh Feed"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs border border-slate-700 transition"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Exit</span>
          </button>
        </div>
      </header>

      {/* Main Command Center Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Statistics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Inbound</p>
              <h3 className="text-2xl font-black text-white mt-1">
                {emergencies.filter(e => ['PENDING', 'ACCEPTED', 'ARRIVED', 'ASSIGNED_HOSPITAL'].includes(e.status)).length}
              </h3>
            </div>
            <div className="p-2.5 bg-rose-600/20 text-rose-400 rounded-xl">
              <Ambulance size={20} />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Bed Prepared</p>
              <h3 className="text-2xl font-black text-amber-400 mt-1">
                {emergencies.filter(e => e.hospitalStatus === 'BED_PREPARED').length}
              </h3>
            </div>
            <div className="p-2.5 bg-amber-600/20 text-amber-400 rounded-xl">
              <Bed size={20} />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Critical SOS</p>
              <h3 className="text-2xl font-black text-red-500 mt-1">
                {emergencies.filter(e => e.status === 'PENDING').length}
              </h3>
            </div>
            <div className="p-2.5 bg-red-600/20 text-red-400 rounded-xl">
              <Siren size={20} className="animate-pulse" />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Handover Complete</p>
              <h3 className="text-2xl font-black text-emerald-400 mt-1">
                {emergencies.filter(e => e.status === 'COMPLETED' || e.hospitalStatus === 'PATIENT_RECEIVED').length}
              </h3>
            </div>
            <div className="p-2.5 bg-emerald-600/20 text-emerald-400 rounded-xl">
              <CheckCircle2 size={20} />
            </div>
          </div>
        </div>

        {/* Emergency Feed Cards */}
        {emergencies.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
            <HeartPulse size={48} className="mx-auto text-slate-600 animate-pulse" />
            <h3 className="text-base font-bold text-slate-300">No active trauma emergency alerts</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Standing by for incoming Government emergency ambulance dispatches and 108 trauma transfers.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Activity size={16} className="text-rose-500" />
                Live Inbound Trauma Alerts ({emergencies.length})
              </h2>
              <span className="text-xs text-slate-500">Auto-refreshing every 5 seconds</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {emergencies.map(emergency => {
                const driver = assignments[emergency._id] || emergency.assignedDriverId
                const driverLoc = normalizeCoords(locations[emergency._id] || emergency.driverLocation || driver?.currentLocation)
                const victimLoc = normalizeCoords(emergency.location)
                const isAccepted = ['ACCEPTED', 'ARRIVED', 'ASSIGNED_HOSPITAL'].includes(emergency.status)
                const isCompleted = emergency.status === 'COMPLETED' || emergency.hospitalStatus === 'PATIENT_RECEIVED'

                const eta = (driverLoc && victimLoc && isAccepted && !isCompleted)
                  ? calculateEta(driverLoc, victimLoc, 45)
                  : null

                const evidenceItems = emergency.evidenceImages || emergency.evidence || []
                const totalPhotos = (emergency.incidentImage ? 1 : 0) + evidenceItems.length

                return (
                  <article
                    key={emergency._id}
                    className={`rounded-3xl border transition-all p-5 shadow-xl flex flex-col justify-between ${
                      isCompleted
                        ? 'bg-slate-900/50 border-slate-800/80 opacity-75'
                        : emergency.status === 'PENDING'
                        ? 'bg-slate-900 border-red-500/50 ring-1 ring-red-500/30'
                        : 'bg-slate-900 border-slate-800'
                    }`}
                  >
                    <div className="space-y-4">
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                isCompleted
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : emergency.status === 'PENDING'
                                  ? 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse'
                                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              }`}
                            >
                              {emergency.status}
                            </span>
                            {emergency.hospitalStatus && (
                              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                {emergency.hospitalStatus.replace('_', ' ')}
                              </span>
                            )}
                            <span className="text-xs text-slate-500 font-mono">
                              #{String(emergency._id).slice(-6)}
                            </span>
                          </div>
                          <h3 className="text-base font-bold text-white">
                            {isCompleted
                              ? 'Trauma Handover Complete'
                              : emergency.status === 'PENDING'
                              ? 'Critical SOS · Awaiting Driver Dispatch'
                              : 'Ambulance Inbound to Patient / Hospital'}
                          </h3>
                        </div>

                        <span
                          className={`p-2.5 rounded-2xl ${
                            isCompleted
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}
                        >
                          <Siren size={20} className={!isCompleted ? 'animate-pulse' : ''} />
                        </span>
                      </div>

                      {/* Live ETA Banner */}
                      {eta && !isCompleted && (
                        <div className="flex items-center justify-between rounded-xl bg-amber-500/10 p-2.5 border border-amber-500/30">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
                            <span className="text-xs font-bold text-amber-300">
                              Ambulance Inbound ETA: {eta.badgeText}
                            </span>
                          </div>
                          <span className="rounded-lg bg-amber-500/30 px-2 py-0.5 text-[11px] font-black text-amber-200 border border-amber-500/40">
                            {eta.text}
                          </span>
                        </div>
                      )}

                      {/* Interactive OpenStreetMap Radar */}
                      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
                        {driverLoc ? (
                          <iframe
                            title={`Hospital Radar ${emergency._id}`}
                            className="h-44 w-full border-0"
                            loading="lazy"
                            src={`https://www.openstreetmap.org/export/embed.html?bbox=${driverLoc.lng - 0.012}%2C${driverLoc.lat - 0.012}%2C${driverLoc.lng + 0.012}%2C${driverLoc.lat + 0.012}&layer=mapnik&marker=${driverLoc.lat}%2C${driverLoc.lng}`}
                          />
                        ) : victimLoc ? (
                          <iframe
                            title={`Patient GPS ${emergency._id}`}
                            className="h-44 w-full border-0"
                            loading="lazy"
                            src={`https://www.openstreetmap.org/export/embed.html?bbox=${victimLoc.lng - 0.008}%2C${victimLoc.lat - 0.008}%2C${victimLoc.lng + 0.008}%2C${victimLoc.lat + 0.008}&layer=mapnik&marker=${victimLoc.lat}%2C${victimLoc.lng}`}
                          />
                        ) : (
                          <div className="h-32 flex items-center justify-center text-xs text-slate-500">
                            <MapPin size={16} className="mr-1" /> GPS coordinates pending
                          </div>
                        )}
                      </div>

                      {/* Patient & Incident Info */}
                      <div className="rounded-2xl bg-slate-950/70 p-3 text-xs space-y-1.5 border border-slate-800/80">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400 font-semibold">Caller / Patient:</span>
                          <span className="text-slate-200 font-bold">
                            {emergency.userId?.name || 'Emergency SOS Caller'}
                          </span>
                        </div>
                        {emergency.userId?.phone && (
                          <div className="flex justify-between items-center">
                            <span className="text-slate-400 font-semibold">Contact Phone:</span>
                            <span className="text-rose-400 font-mono font-bold">
                              {emergency.userId.phone}
                            </span>
                          </div>
                        )}
                        {emergency.userId?.bloodGroup && (
                          <div className="flex justify-between items-center">
                            <span className="text-slate-400 font-semibold">Blood Group:</span>
                            <span className="px-2 py-0.5 rounded-md bg-red-600/30 text-red-300 font-bold text-[10px]">
                              {emergency.userId.bloodGroup}
                            </span>
                          </div>
                        )}
                        {emergency.incidentDetails && (
                          <div className="pt-1 border-t border-slate-800">
                            <span className="text-slate-400 font-semibold block text-[10px] uppercase">
                              Incident & Medical Notes:
                            </span>
                            <p className="text-slate-200 text-xs mt-0.5 italic">
                              "{emergency.incidentDetails}"
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Scene Evidence Gallery */}
                      {totalPhotos > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                              <Camera size={13} className="text-rose-400" />
                              <span>Scene Evidence Photos ({totalPhotos})</span>
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveEmergencyForModal(emergency)
                                setActivePhotoIndex(0)
                                setFullViewModalOpen(true)
                              }}
                              className="text-[11px] font-bold text-rose-400 hover:text-rose-300 transition"
                            >
                              Full View Gallery →
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {(emergency.incidentImage?.url || (typeof emergency.incidentImage === 'string' && emergency.incidentImage)) && (
                              <img
                                src={emergency.incidentImage?.url || emergency.incidentImage}
                                alt="Emergency Report Initial Photo"
                                onClick={() => {
                                  setActiveEmergencyForModal(emergency)
                                  setActivePhotoIndex(0)
                                  setFullViewModalOpen(true)
                                }}
                                className="h-14 w-14 rounded-xl object-cover border border-slate-700 hover:opacity-80 cursor-pointer shadow"
                              />
                            )}
                            {evidenceItems.map((item, idx) => {
                              const url = typeof item === 'string' ? item : item?.url
                              if (!url) return null
                              return (
                                <img
                                  key={idx}
                                  src={url}
                                  alt={`Witness Evidence ${idx + 1}`}
                                  onClick={() => {
                                    setActiveEmergencyForModal(emergency)
                                    setActivePhotoIndex(idx + (emergency.incidentImage ? 1 : 0))
                                    setFullViewModalOpen(true)
                                  }}
                                  className="h-14 w-14 rounded-xl object-cover border border-slate-700 hover:opacity-80 cursor-pointer shadow"
                                />
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Assigned Driver & Ambulance Details */}
                      <div className="flex items-center justify-between rounded-2xl bg-slate-950/70 p-3 border border-slate-800">
                        <div className="flex items-center gap-2.5">
                          <div className="grid h-10 w-10 place-items-center rounded-xl bg-red-600/30 text-red-400 border border-red-500/30">
                            <Ambulance size={18} />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-white">
                              {driver?.name || 'Awaiting Driver Assignment'}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {driver?.phone ? `Phone: ${driver.phone}` : 'Government Emergency Unit'} · {driver?.ambulanceType || 'ALS Ambulance'}
                            </p>
                          </div>
                        </div>
                        {driverLoc && (
                          <a
                            href={`https://www.google.com/maps?q=${driverLoc.lat},${driverLoc.lng}`}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg bg-rose-600 hover:bg-rose-500 px-2.5 py-1 text-[11px] font-bold text-white shadow transition"
                          >
                            Live Map
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Hospital Action Buttons */}
                    <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center gap-2.5">
                      <button
                        type="button"
                        disabled={actionLoading[emergency._id] || isCompleted}
                        onClick={() => handleHospitalAction(emergency._id, 'BED_PREPARED')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold transition shadow-md ${
                          emergency.hospitalStatus === 'BED_PREPARED'
                            ? 'bg-amber-600/30 text-amber-300 border border-amber-500/40'
                            : 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30'
                        } disabled:opacity-50`}
                      >
                        <Bed size={15} />
                        <span>
                          {actionLoading[emergency._id] === 'BED_PREPARED'
                            ? 'Preparing...'
                            : emergency.hospitalStatus === 'BED_PREPARED'
                            ? 'ER Bed Ready (Notified)'
                            : 'Acknowledge / Prepare ER Bed'}
                        </span>
                      </button>

                      <button
                        type="button"
                        disabled={actionLoading[emergency._id] || isCompleted}
                        onClick={() => handleHospitalAction(emergency._id, 'PATIENT_RECEIVED')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold transition shadow-md ${
                          isCompleted
                            ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                        } disabled:opacity-50`}
                      >
                        <CheckCircle2 size={15} />
                        <span>
                          {actionLoading[emergency._id] === 'PATIENT_RECEIVED'
                            ? 'Confirming...'
                            : isCompleted
                            ? 'Handover Completed'
                            : 'Confirm Patient Handover'}
                        </span>
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        )}
      </main>

      {/* Full View Evidence Gallery Modal with Sequential Carousel */}
      {fullViewModalOpen && activeEmergencyForModal && (() => {
        const allPhotos = []
        if (activeEmergencyForModal.incidentImage?.url || (typeof activeEmergencyForModal.incidentImage === 'string' && activeEmergencyForModal.incidentImage)) {
          allPhotos.push({
            url: activeEmergencyForModal.incidentImage?.url || activeEmergencyForModal.incidentImage,
            note: 'Initial Emergency Dispatch Photo',
            uploadedAt: activeEmergencyForModal.createdAt
          })
        }
        const extraImages = activeEmergencyForModal.evidenceImages || activeEmergencyForModal.evidence || []
        extraImages.forEach((img, idx) => {
          const imgUrl = img?.url || (typeof img === 'string' ? img : null)
          if (imgUrl && !allPhotos.some(p => p.url === imgUrl)) {
            allPhotos.push({
              url: imgUrl,
              note: img?.note || `Witness Scene Evidence #${idx + 1}`,
              uploadedAt: img?.uploadedAt || activeEmergencyForModal.createdAt
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
              className="relative flex max-h-[95vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-slate-950 text-white shadow-2xl border border-slate-800"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-800/80 px-4 py-3 bg-slate-900/60">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-rose-600/30 text-rose-400 border border-rose-500/30">
                    <Camera size={16} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold truncate">Hospital Trauma Evidence & Medical Notes</h3>
                    <p className="text-[10px] text-slate-400 font-mono">
                      Photo {activePhotoIndex + 1} of {totalPhotos} · Incident #{String(activeEmergencyForModal._id).slice(-6)}
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

              {/* Photo Viewer with Carousel Controls */}
              <div className="relative flex min-h-[340px] max-h-[55vh] flex-1 items-center justify-center bg-black p-3">
                {currentPhoto && (
                  <img
                    src={currentPhoto.url}
                    alt={`Trauma incident photo ${activePhotoIndex + 1}`}
                    className="max-h-[52vh] w-auto max-w-full rounded-2xl object-contain shadow-2xl"
                  />
                )}

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
              </div>

              {/* Notes & Description Footer */}
              <div className="border-t border-slate-800/80 bg-slate-900/80 px-4 py-3 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span className="font-semibold text-rose-400">{currentPhoto?.note}</span>
                  {currentPhoto?.uploadedAt && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(currentPhoto.uploadedAt).toLocaleTimeString()}
                    </span>
                  )}
                </div>
                {activeEmergencyForModal.incidentDetails && (
                  <div className="rounded-xl bg-slate-950/70 p-2.5 text-xs text-slate-300 border border-slate-800">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Patient / Bystander Report:
                    </p>
                    <p className="mt-0.5 text-slate-200">{activeEmergencyForModal.incidentDetails}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
