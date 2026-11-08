import { Camera, Check, RotateCcw, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'

function compressImage(source, width, height) {
  const scale = Math.min(1, 1280 / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.78)
}

function fileToJpeg(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('That photo could not be read.'))
    reader.onload = () => {
      const image = new Image()
      image.onerror = () => reject(new Error('That photo could not be opened.'))
      image.onload = () => resolve(compressImage(image, image.naturalWidth, image.naturalHeight))
      image.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

export default function DriverCameraModal({ onClose, onCaptured }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const fileRef = useRef(null)
  const [preview, setPreview] = useState(null)
  const [ready, setReady] = useState(false)
  const [nativeCamera, setNativeCamera] = useState(false)

  useEffect(() => {
    let active = true
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setNativeCamera(true)
      return () => { active = false }
    }

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then(stream => {
        if (!active) return stream.getTracks().forEach(track => track.stop())
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      })
      .catch(() => {
        if (active) setNativeCamera(true)
      })

    return () => {
      active = false
      streamRef.current?.getTracks().forEach(track => track.stop())
    }
  }, [])

  const capture = () => {
    const video = videoRef.current
    if (!video?.videoWidth || !video.videoHeight) return toast.error('Camera is not ready yet.')
    setPreview(compressImage(video, video.videoWidth, video.videoHeight))
  }

  const chooseSelfie = async event => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Choose an image for your selfie.')
      return
    }
    try {
      setPreview(await fileToJpeg(file))
    } catch (error) {
      toast.error(error.message || 'That photo could not be opened.')
    } finally {
      event.target.value = ''
    }
  }

  const usePhoto = () => {
    if (!preview) return
    onCaptured(preview)
    onClose()
  }

  const openCamera = () => {
    if (ready) capture()
    else fileRef.current?.click()
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
    <section className="w-full max-w-[420px] overflow-hidden rounded-3xl bg-slate-900 text-white">
      <div className="flex items-center justify-between p-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-red-300">Identity check</p>
          <h2 className="mt-1 font-display text-lg font-bold">Take your selfie</h2>
        </div>
        <button onClick={onClose} aria-label="Close selfie camera" className="grid h-9 w-9 place-items-center rounded-full border border-slate-700 bg-slate-800 text-white"><X size={17} /></button>
      </div>
      <div className="relative aspect-[4/3] bg-black">
        <video ref={videoRef} autoPlay playsInline muted onCanPlay={() => setReady(true)} className={`h-full w-full object-cover ${preview || !ready ? 'hidden' : ''}`} />
        <img src={preview || ''} alt="Selfie preview" className={`h-full w-full object-cover ${preview ? '' : 'hidden'}`} />
        {!preview && !ready && <div className="absolute inset-0 grid place-items-center px-8 text-center text-sm text-white/80">Tap the camera button to open your phone camera.</div>}
        {(!preview && ready || preview) && <div className="pointer-events-none absolute inset-10 rounded-[45%] border-2 border-dashed border-white/80" />}
        {ready && !preview && <p className="absolute bottom-3 left-0 right-0 text-center text-xs text-white/80">Center your face inside the oval</p>}
      </div>
      <div className="flex items-center justify-center gap-5 p-5">
        {preview ? <>
          <button onClick={() => setPreview(null)} aria-label="Retake selfie" className="grid h-12 w-12 place-items-center rounded-full border border-slate-700 bg-slate-800 text-white"><RotateCcw size={18} /></button>
          <button onClick={usePhoto} className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-slate-950"><Check size={17} /> Use selfie</button>
        </> : <button onClick={openCamera} aria-label={ready ? 'Capture selfie' : 'Open phone camera'} className="grid h-16 w-16 place-items-center rounded-full border-4 border-slate-600 bg-red-600 text-white"><Camera size={25} /></button>}
        <input ref={fileRef} type="file" accept="image/*" capture="user" onChange={chooseSelfie} className="hidden" />
      </div>
    </section>
  </div>
}
