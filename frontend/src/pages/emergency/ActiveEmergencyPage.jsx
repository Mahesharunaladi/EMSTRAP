import { Ambulance, ArrowLeft, Camera, Check, CheckCircle2, ChevronRight, Clock, HeartPulse, MapPin, Navigation, PhoneCall, Plus, RefreshCw, Send, ShieldAlert, Siren, UploadCloud, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../services/api'
import { joinUserRoom, onDriverAssigned, onDriverLocationUpdated } from '../../services/emergencySocket'
import { normalizeCoords } from '../../utils/geoUtils'
import { calculateEta } from '../../utils/etaCalculator'
import CameraCaptureModal from '../../components/CameraCaptureModal'

export default function ActiveEmergencyPage() {
  const { emergencyId } = useParams()
  const navigate = useNavigate()

  const [emergency, setEmergency] = useState(null)
  const [driver, setDriver] = useState(null)
  const [driverLocation, setDriverLocation] = useState(null)
  const [description, setDescription] = useState('')
  const [savingDesc, setSavingDesc] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [modalImage, setModalImage] = useState(null)
  const [loading, setLoading] = useState(true)

  // Fetch initial emergency details
  const fetchEmergency = useCallback(async () => {
    try {
      const { data } = await api.get(`/emergency/${emergencyId}`)
      if (data?.data?.emergency) {
        const em = data.data.emergency
        setEmergency(em)
        setDescription(em.incidentDetails || '')
        if (em.driver || em.assignedDriverId) {
          const d = em.driver || (typeof em.assignedDriverId === 'object' ? em.assignedDriverId : null)
          if (d) setDriver(d)
        }
        const initialLoc = normalizeCoords(em.driverLocation || em.assignedDriverId?.currentLocation)
        if (initialLoc) setDriverLocation(initialLoc)
      }
    } catch (err) {
      console.warn('Could not load specific emergency details:', err.message)
    } finally {
      setLoading(false)
    }
  }, [emergencyId])

  useEffect(() => {
    fetchEmergency()
  }, [fetchEmergency])

  // Join emergency socket room & listen for driver assignment & live GPS updates
  useEffect(() => {
    if (!emergencyId) return
    const cleanupRoom = joinUserRoom(emergency?.userId || 'guest', emergencyId)

    const unsubDriver = onDriverAssigned(assignment => {
      if (String(assignment.emergencyId) === String(emergencyId)) {
        setEmergency(prev => ({
          ...(prev || {}),
          status: assignment.status || 'ACCEPTED',
          driver: assignment.driver,
        }))
        if (assignment.driver) {
          setDriver(assignment.driver)
          const dLoc = normalizeCoords(assignment.driver.currentLocation)
          if (dLoc) setDriverLocation(dLoc)
        }
        toast.success('Government Ambulance has accepted your emergency request!')
      }
    })

    const unsubLoc = onDriverLocationUpdated(payload => {
      if (!payload?.emergencyId || String(payload.emergencyId) === String(emergencyId)) {
        const normLoc = normalizeCoords(payload?.location)
        if (normLoc) {
          setDriverLocation(normLoc)
        }
      }
    })

    return () => {
      cleanupRoom()
      unsubDriver()
      unsubLoc()
    }
  }, [emergencyId, emergency?.userId])

  // Calculate live ETA
  const eta = useMemo(() => {
    const incLoc = normalizeCoords(emergency?.location)
    const drvLoc = normalizeCoords(driverLocation)
    if (incLoc && drvLoc && (emergency?.status === 'ACCEPTED' || emergency?.status === 'ARRIVED')) {
      return calculateEta(drvLoc, incLoc, 45) // ~45 km/h emergency response speed
    }
    return null
  }, [emergency?.location, driverLocation, emergency?.status])

  // Save / Update Incident Description
  const handleSaveDescription = async () => {
    if (!description.trim()) return
    setSavingDesc(true)
    try {
      const { data } = await api.patch(`/emergency/${emergencyId}/description`, { incidentDetails: description.trim() })
      setEmergency(prev => ({ ...(prev || {}), incidentDetails: description.trim() }))
      toast.success('Incident description updated and sent to responders!')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update description')
    } finally {
      setSavingDesc(false)
    }
  }

  // Upload Additional Scene Evidence Photo
  const handleAdditionalPhotoCaptured = async payload => {
    setCameraOpen(false)
    if (!payload?.image) return
    setUploadingPhoto(true)
    try {
      const { data } = await api.patch(`/emergency/${emergencyId}/evidence`, { image: payload.image })
      if (data?.data?.evidenceImages) {
        setEmergency(prev => ({ ...(prev || {}), evidence: data.data.evidenceImages, evidenceImages: data.data.evidenceImages }))
      }
      toast.success('Scene evidence photo added successfully!')
      fetchEmergency()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload photo evidence')
    } finally {
      setUploadingPhoto(false)
    }
  }

  const incidentCoords = normalizeCoords(emergency?.location)
  const validDriverCoords = normalizeCoords(driverLocation)
  const evidenceList = emergency?.evidenceImages || emergency?.evidence || []

  return (
    <div className="min-h-screen bg-[#f7f7f5] text-slate-900 pb-16">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-red-200 bg-white/95 px-4 py-3.5 backdrop-blur-md">
        <div className="mx-auto flex max-w-xl items-center justify-between">
          <button
            onClick={() => navigate('/app')}
            className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200"
          >
            <ArrowLeft size={15} /> Dashboard
          </button>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-600 animate-pulse" />
            <span className="font-display text-sm font-bold uppercase tracking-wider text-red-600">
              Active Incident #{String(emergencyId).slice(-6)}
            </span>
          </div>
          <button
            onClick={fetchEmergency}
            title="Refresh Status"
            className="grid h-8 w-8 place-items-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 pt-5 space-y-5">
        {/* Status & ETA Banner */}
        <section className="rounded-3xl border-2 border-red-400 bg-gradient-to-br from-red-600 to-rose-700 p-5 text-white shadow-xl shadow-red-600/20">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/20 text-white backdrop-blur-sm">
                <Siren size={26} className="animate-pulse" />
              </span>
              <div>
                <span className="rounded-full bg-white/25 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                  {emergency?.status === 'ACCEPTED' ? 'Ambulance En Route' : emergency?.status === 'ARRIVED' ? 'Arrived On Scene' : 'Dispatching Responders'}
                </span>
                <h1 className="mt-1 font-display text-xl font-bold leading-tight">
                  {emergency?.status === 'ACCEPTED' ? 'Government Ambulance Responding' : emergency?.status === 'ARRIVED' ? 'Responder Has Arrived' : 'Alerting Nearest Units'}
                </h1>
              </div>
            </div>
          </div>

          {/* Live ETA Badge */}
          {emergency?.status === 'ACCEPTED' && (
            <div className="mt-4 rounded-2xl bg-black/25 p-3.5 backdrop-blur-sm border border-white/15">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock size={18} className="text-amber-300 animate-pulse" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">Estimated Arrival Time (ETA)</p>
                    <p className="text-base font-bold text-white">
                      {eta ? eta.badgeText : 'Calculating live route…'}
                    </p>
                  </div>
                </div>
                {eta && (
                  <span className="rounded-xl bg-amber-400 px-3 py-1 text-xs font-black text-slate-950 shadow">
                    {eta.text}
                  </span>
                )}
              </div>
            </div>
          )}

          {emergency?.status === 'PENDING' && (
            <div className="mt-3 flex items-center gap-2 text-xs text-white/90">
              <span className="h-2 w-2 rounded-full bg-white animate-ping" />
              Dispatching nearest Government Ambulance and alerting Police Command...
            </div>
          )}
        </section>

        {/* Live Interactive OpenStreetMap Frame */}
        <section className="overflow-hidden rounded-3xl border border-slate-300 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 bg-slate-50">
            <span className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <MapPin size={16} className="text-red-600" /> Live Response Radar
            </span>
            {validDriverCoords && (
              <a
                href={`https://www.google.com/maps?q=${validDriverCoords.lat},${validDriverCoords.lng}`}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-bold text-emerald-700 underline"
              >
                Track in Google Maps
              </a>
            )}
          </div>

          <div className="relative h-64 w-full bg-slate-200">
            {validDriverCoords ? (
              <iframe
                title="Emergency Ambulance Live Radar"
                className="h-full w-full border-0"
                loading="lazy"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${validDriverCoords.lng - 0.01}%2C${validDriverCoords.lat - 0.01}%2C${validDriverCoords.lng + 0.01}%2C${validDriverCoords.lat + 0.01}&layer=mapnik&marker=${validDriverCoords.lat}%2C${validDriverCoords.lng}`}
              />
            ) : incidentCoords ? (
              <iframe
                title="Incident Scene Radar"
                className="h-full w-full border-0"
                loading="lazy"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${incidentCoords.lng - 0.008}%2C${incidentCoords.lat - 0.008}%2C${incidentCoords.lng + 0.008}%2C${incidentCoords.lat + 0.008}&layer=mapnik&marker=${incidentCoords.lat}%2C${incidentCoords.lng}`}
              />
            ) : (
              <div className="grid h-full place-items-center text-xs text-slate-500">Connecting radar…</div>
            )}
          </div>

          {incidentCoords && (
            <div className="p-3 bg-slate-50 text-[11px] text-slate-600 border-t border-slate-200 flex items-center justify-between">
              <span>Incident: {incidentCoords.lat.toFixed(5)}, {incidentCoords.lng.toFixed(5)}</span>
              {validDriverCoords && <span>Ambulance: {validDriverCoords.lat.toFixed(5)}, {validDriverCoords.lng.toFixed(5)}</span>}
            </div>
          )}
        </section>

        {/* Assigned Driver Card */}
        {(driver?.name || driver?.phone) && (
          <section className="flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
              {driver.photo || driver.selfie?.url ? (
                <img src={driver.photo || driver.selfie?.url} alt="Driver" className="h-12 w-12 rounded-full object-cover border-2 border-red-300" />
              ) : (
                <span className="grid h-12 w-12 place-items-center rounded-full bg-red-600 text-white">
                  <Ambulance size={22} />
                </span>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-slate-900 truncate">{driver.name || 'Government Ambulance Driver'}</p>
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-bold text-red-700">Govt Unit</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">{driver.phone || 'Emergency Responder'}</p>
              </div>
            </div>
            {driver.phone && (
              <a
                href={`tel:${driver.phone}`}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2.5 text-xs font-bold text-white shadow hover:bg-emerald-700"
              >
                <PhoneCall size={14} /> Call
              </a>
            )}
          </section>
        )}

        {/* Incident Description Box */}
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <ShieldAlert size={16} className="text-red-600" /> Incident Description & Condition
            </h2>
            <span className="text-[10px] text-slate-400">Live synced with responders</span>
          </div>
          <p className="text-xs text-slate-500">
            Provide details to help responders prepare (e.g. number of victims, conscious status, nearest landmark).
          </p>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            placeholder="Type patient status, symptoms, or landmark notes here…"
            className="w-full rounded-2xl border border-slate-300 p-3 text-xs leading-relaxed outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
          />
          <button
            onClick={handleSaveDescription}
            disabled={savingDesc || !description.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {savingDesc ? 'Saving…' : <><Check size={14} /> Save / Update Description</>}
          </button>
        </section>

        {/* Additional Scene Photos / Evidence Gallery */}
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Camera size={16} className="text-red-600" /> Scene Evidence Photos
              </h2>
              <p className="mt-1 text-xs text-slate-500">Add extra photos from the scene at any time.</p>
            </div>
            <button
              onClick={() => setCameraOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-red-600 px-3 py-2 text-xs font-bold text-white shadow hover:bg-red-700"
            >
              <Plus size={15} /> Add Photo
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {emergency?.incidentImage?.url && (
              <div
                onClick={() => setModalImage(emergency.incidentImage.url)}
                className="relative aspect-square cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
              >
                <img src={emergency.incidentImage.url} alt="Initial incident" className="h-full w-full object-cover" />
                <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 py-0.5 text-[8px] font-bold text-white">Initial</span>
              </div>
            )}
            {evidenceList.map((item, idx) => {
              const url = typeof item === 'string' ? item : item?.url
              if (!url) return null
              return (
                <div
                  key={idx}
                  onClick={() => setModalImage(url)}
                  className="relative aspect-square cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
                >
                  <img src={url} alt={`Evidence ${idx + 1}`} className="h-full w-full object-cover" />
                  <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 py-0.5 text-[8px] font-bold text-white">#{idx + 1}</span>
                </div>
              )
            })}
          </div>
        </section>
      </main>

      {/* Enlarged Photo Modal */}
      {modalImage && (
        <div
          role="dialog"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setModalImage(null)}
        >
          <div className="relative max-h-[85vh] max-w-lg overflow-hidden rounded-2xl bg-slate-950 p-2" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setModalImage(null)}
              className="absolute right-3 top-3 z-10 rounded-full bg-white/20 p-1.5 text-white hover:bg-white/30"
            >
              <X size={16} />
            </button>
            <img src={modalImage} alt="Enlarged evidence" className="max-h-[80vh] w-auto rounded-xl object-contain mx-auto" />
          </div>
        </div>
      )}

      {/* Camera Capture Modal for Adding Photos */}
      {cameraOpen && (
        <CameraCaptureModal
          onClose={() => setCameraOpen(false)}
          onCaptured={handleAdditionalPhotoCaptured}
          fallbackLocation={emergency?.location}
        />
      )}
    </div>
  )
}
