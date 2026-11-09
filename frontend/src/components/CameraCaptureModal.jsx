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
  const [location, setLocation] = useState(null)
  const [cameraState, setCameraState] = useState('starting')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    let active = true
    navigator.geolocation?.getCurrentPosition(
      ({ coords }) => active && setLocation({ lat: coords.latitude, lng: coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 },
    )
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
  }, [])

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
    const emergencyLocation = location || fallbackLocation
    if (!emergencyLocation || emergencyLocation.source === 'network-approximation' || !Number.isFinite(Number(emergencyLocation.lat)) || !Number.isFinite(Number(emergencyLocation.lng))) {
      toast.error('A precise GPS fix is required for an SOS. Open the app over HTTPS or localhost, allow location access, and retry.')
      return
    }
    setSending(true)
    try {
      await onCaptured({ image: preview, location: emergencyLocation, capturedAt: new Date().toISOString() })
      streamRef.current?.getTracks().forEach(track => track.stop())
    } catch (error) {
      toast.error(error.message || 'Could not send the emergency. Please try again.')
    } finally {
      setSending(false)
    }
  }

  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/85 p-0 backdrop-blur-sm sm:items-center sm:p-4"><div className="w-full max-w-lg overflow-hidden rounded-t-3xl border border-slate-700 bg-slate-900 sm:rounded-3xl">
    <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4"><div><p className="text-[11px] font-bold uppercase tracking-[.18em] text-red-400">Emergency evidence</p><h2 className="font-display text-lg font-bold text-white">Capture incident photo</h2></div><button onClick={onClose} aria-label="Close camera" className="rounded-full p-2 text-slate-400 hover:bg-slate-800"><X size={20} /></button></div>
    <div className="relative aspect-[4/3] bg-slate-950"><video ref={videoRef} autoPlay playsInline muted onLoadedData={() => setCameraState('ready')} onCanPlay={() => setCameraState('ready')} className={`h-full w-full object-cover ${preview ? 'hidden' : ''}`} /><img src={preview || ''} alt="Incident preview" className={`h-full w-full object-cover ${preview ? '' : 'hidden'}`} />{!preview && cameraState !== 'ready' && <div className="absolute inset-0 grid place-items-center px-8 text-center text-sm text-white/80">{cameraState === 'starting' ? 'Starting camera…' : 'Tap the camera button to open your phone camera.'}</div>}{!preview && cameraState === 'ready' && <div className="pointer-events-none absolute inset-10 rounded-2xl border border-white/40" />}{!preview && cameraState === 'ready' && <p className="absolute bottom-4 left-0 right-0 text-center text-xs text-white/80">Center the incident in the frame</p>}</div>
    <div className="flex items-center gap-3 border-b border-slate-800 px-5 py-4 text-xs text-slate-400"><MapPin size={15} className="text-emerald-400" /><span>{location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : window.isSecureContext ? 'Waiting for GPS permission' : 'GPS requires HTTPS or localhost'}</span><span className="ml-auto flex items-center gap-1 text-emerald-400"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{location ? 'GPS ready' : 'GPS required for SOS'}</span></div>
    <div className="flex items-center justify-center gap-5 p-5">{preview ? <><button disabled={sending} onClick={() => setPreview(null)} aria-label="Retake photo" className="grid h-12 w-12 place-items-center rounded-full bg-slate-800 text-slate-300 disabled:opacity-50"><RotateCcw size={19} /></button><button disabled={sending} onClick={submit} className="flex h-12 items-center gap-2 rounded-full bg-red-500 px-7 font-bold text-white shadow-lg shadow-red-950/50 disabled:opacity-60"><Check size={18} /> {sending ? 'Sending…' : 'Send SOS'}</button></> : <button onClick={() => cameraState === 'ready' ? capture() : fileRef.current?.click()} aria-label="Open camera" className="grid h-16 w-16 place-items-center rounded-full border-4 border-slate-700 bg-red-500 text-white shadow-lg shadow-red-950/50"><Camera size={25} /></button>}<button onClick={() => fileRef.current?.click()} aria-label="Choose incident photo" className="grid h-12 w-12 place-items-center rounded-full bg-slate-800 text-slate-300"><ImagePlus size={19} /></button><input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={choosePhoto} className="hidden" /></div>
  </div></div>
}
