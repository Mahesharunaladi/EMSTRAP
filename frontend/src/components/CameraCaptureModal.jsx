import { Camera, Check, ImagePlus, MapPin, RotateCcw, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'

function canvasImage(source, width, height) {
  const scale = Math.min(1, 1280 / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.68)
}

export default function CameraCaptureModal({ onClose, onCaptured, fallbackLocation }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const fileRef = useRef(null)
  const [preview, setPreview] = useState(null)
  const [location, setLocation] = useState(() => fallbackLocation || null)
  const [cameraState, setCameraState] = useState('starting')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    let active = true

    const getPosition = () => {
      if (fallbackLocation && Number.isFinite(Number(fallbackLocation.lat)) && Number.isFinite(Number(fallbackLocation.lng))) {
        if (active) setLocation(fallbackLocation)
        return
      }
      if (typeof window !== 'undefined' && sessionStorage.getItem('emstrap_corelocation_unavailable') === 'true') {
        return
      }
      if (!navigator.geolocation) {
        if (fallbackLocation && active) setLocation(fallbackLocation)
        return
      }
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          if (active) setLocation({ lat: coords.latitude, lng: coords.longitude, source: 'browser-gps' })
        },
        async () => {
          if (!active) return
          if (fallbackLocation) {
            setLocation(fallbackLocation)
            return
          }
          try {
            const res = await fetch('https://ipwho.is/', { signal: AbortSignal.timeout(3000) })
            if (res.ok) {
              const d = await res.json()
              if (active && Number.isFinite(d.latitude) && Number.isFinite(d.longitude)) {
                setLocation({ lat: Number(d.latitude), lng: Number(d.longitude), source: 'network-approximation' })
                return
              }
            }
          } catch (_) {}
          try {
            const res2 = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(3000) })
            if (res2.ok) {
              const d2 = await res2.json()
              if (active && Number.isFinite(d2.latitude) && Number.isFinite(d2.longitude)) {
                setLocation({ lat: Number(d2.latitude), lng: Number(d2.longitude), source: 'network-approximation' })
              }
            }
          } catch (_) {}
        },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 },
      )
    }

    getPosition()

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setCameraState('file-camera')
    } else {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
        .then(async stream => {
          if (!active) return stream.getTracks().forEach(track => track.stop())
          streamRef.current = stream
          if (videoRef.current) {
            videoRef.current.srcObject = stream
            try { await videoRef.current.play() } catch {}
          }
        })
        .catch(() => active && setCameraState('file-camera'))
    }
    return () => {
      active = false
      streamRef.current?.getTracks().forEach(track => track.stop())
    }
  }, [fallbackLocation])

  const capture = () => {
    const video = videoRef.current
    if (cameraState !== 'ready' || !video?.videoWidth || !video?.videoHeight) {
      fileRef.current?.click()
      return
    }
    setPreview(canvasImage(video, video.videoWidth, video.videoHeight))
  }

  const choosePhoto = event => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return toast.error('Choose an image file.')
    const reader = new FileReader()
    reader.onload = () => {
      const image = new Image()
      image.onload = () => setPreview(canvasImage(image, image.naturalWidth, image.naturalHeight))
      image.onerror = () => toast.error('That image could not be opened.')
      image.src = reader.result
    }
    reader.onerror = () => toast.error('That image could not be read.')
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  const submit = async () => {
    if (!preview || sending) return
    let emergencyLocation = location || fallbackLocation
    let lat = Number(emergencyLocation?.lat)
    let lng = Number(emergencyLocation?.lng)

    if (!emergencyLocation || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      try {
        const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(1500) })
        if (res.ok) {
          const d = await res.json()
          if (Number.isFinite(d.latitude) && Number.isFinite(d.longitude)) {
            emergencyLocation = { lat: Number(d.latitude), lng: Number(d.longitude), source: 'network-approximation' }
            lat = emergencyLocation.lat
            lng = emergencyLocation.lng
          }
        }
      } catch (_) {}
    }

    if (!emergencyLocation || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      emergencyLocation = { lat: 12.9716, lng: 77.5946, source: 'system-default' }
      lat = emergencyLocation.lat
      lng = emergencyLocation.lng
    }

    const cleanLocation = {
      lat,
      lng,
      source: emergencyLocation.source || 'browser-gps',
    }

    setSending(true)
    try {
      await onCaptured({ image: preview, location: cleanLocation, capturedAt: new Date().toISOString() })
      streamRef.current?.getTracks().forEach(track => track.stop())
    } catch (error) {
      toast.error(error.message || 'Could not send the emergency. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const effectiveLocation = location || fallbackLocation

  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/85 p-0 backdrop-blur-sm sm:items-center sm:p-4"><div className="w-full max-w-lg overflow-hidden rounded-t-3xl border border-slate-700 bg-slate-900 sm:rounded-3xl">
    <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4"><div><p className="text-[11px] font-bold uppercase tracking-[.18em] text-red-400">Emergency evidence</p><h2 className="font-display text-lg font-bold text-white">Capture incident photo</h2></div><button onClick={onClose} aria-label="Close camera" className="rounded-full p-2 text-slate-400 hover:bg-slate-800"><X size={20} /></button></div>
    <div className="relative aspect-[4/3] bg-slate-950"><video ref={videoRef} autoPlay playsInline muted onLoadedData={() => setCameraState('ready')} onCanPlay={() => setCameraState('ready')} className={`h-full w-full object-cover ${preview ? 'hidden' : ''}`} /><img src={preview || ''} alt="Incident preview" className={`h-full w-full object-cover ${preview ? '' : 'hidden'}`} />{!preview && cameraState !== 'ready' && <div className="absolute inset-0 grid place-items-center px-8 text-center text-sm text-white/80">{cameraState === 'starting' ? 'Starting camera…' : 'Tap the camera button to open your phone camera.'}</div>}{!preview && cameraState === 'ready' && <div className="pointer-events-none absolute inset-10 rounded-2xl border border-white/40" />}{!preview && cameraState === 'ready' && <p className="absolute bottom-4 left-0 right-0 text-center text-xs text-white/80">Center the incident in the frame</p>}</div>
    <div className="flex items-center gap-3 border-b border-slate-800 px-5 py-4 text-xs text-slate-400"><MapPin size={15} className={effectiveLocation ? "text-emerald-400" : "text-amber-400"} /><span>{effectiveLocation ? `${effectiveLocation.lat.toFixed(4)}, ${effectiveLocation.lng.toFixed(4)}` : window.isSecureContext ? 'Detecting location…' : 'GPS requires HTTPS'}</span><span className="ml-auto flex items-center gap-1 text-emerald-400"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{effectiveLocation ? 'Location ready' : 'Detecting location'}</span></div>
    <div className="flex items-center justify-center gap-5 p-5">{preview ? <><button disabled={sending} onClick={() => setPreview(null)} aria-label="Retake photo" className="grid h-12 w-12 place-items-center rounded-full bg-slate-800 text-slate-300 disabled:opacity-50"><RotateCcw size={19} /></button><button disabled={sending} onClick={submit} className="flex h-12 items-center gap-2 rounded-full bg-red-500 px-7 font-bold text-white shadow-lg shadow-red-950/50 disabled:opacity-60"><Check size={18} /> {sending ? 'Sending…' : 'Send SOS'}</button></> : <button onClick={() => cameraState === 'ready' ? capture() : fileRef.current?.click()} aria-label="Open camera" className="grid h-16 w-16 place-items-center rounded-full border-4 border-slate-700 bg-red-500 text-white shadow-lg shadow-red-950/50"><Camera size={25} /></button>}<button onClick={() => fileRef.current?.click()} aria-label="Choose incident photo" className="grid h-12 w-12 place-items-center rounded-full bg-slate-800 text-slate-300"><ImagePlus size={19} /></button><input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={choosePhoto} className="hidden" /></div>
  </div></div>
}
