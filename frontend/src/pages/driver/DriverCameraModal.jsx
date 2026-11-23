import { Camera, Check, RotateCcw, User, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'

function compressImage(source, width, height) {
  const scale = Math.min(1, 1024 / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.85)
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

export default function DriverCameraModal({
  onClose,
  onCaptured,
  title = 'Driver Face Photo',
  subtitle = 'Identity Check',
  instructions = 'Center your face clearly inside the frame'
}) {
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

    navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    })
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

  const choosePhoto = async event => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Choose an image file for your face photo.')
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-md">
      <section className="w-full max-w-[440px] overflow-hidden rounded-3xl border border-slate-700/80 bg-slate-900 text-white shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-red-500/20 text-red-400">
              <User size={18} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.18em] text-red-400">{subtitle}</p>
              <h2 className="font-display text-base font-bold text-white">{title}</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close camera"
            className="grid h-9 w-9 place-items-center rounded-full border border-slate-700 bg-slate-800 text-white hover:bg-slate-700 transition"
          >
            <X size={17} />
          </button>
        </div>

        {/* Viewfinder Window with standard portrait oval */}
        <div className="relative aspect-[4/3] bg-black overflow-hidden flex items-center justify-center">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            onCanPlay={() => setReady(true)}
            className={`h-full w-full object-cover ${preview || !ready ? 'hidden' : ''}`}
          />
          {preview ? (
            <img
              src={preview}
              alt="Driver face preview"
              className="h-full w-full object-cover"
            />
          ) : !ready ? (
            <div className="absolute inset-0 grid place-items-center px-8 text-center text-sm text-white/80">
              Starting camera… Or tap the button below to upload.
            </div>
          ) : (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              {/* Standard portrait/circular face guide */}
              <div className="relative w-56 h-72 rounded-[48%] border-2 border-dashed border-white/80 bg-white/5 shadow-[0_0_0_9999px_rgba(2,6,23,0.5)]" />
              <p className="mt-4 text-center text-xs font-semibold text-white drop-shadow-md px-4">
                {instructions}
              </p>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-5 p-4 border-t border-slate-800 bg-slate-900/90">
          {preview ? (
            <>
              <button
                onClick={() => setPreview(null)}
                aria-label="Retake photo"
                className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-700 transition"
              >
                <RotateCcw size={15} /> Retake
              </button>
              <button
                onClick={usePhoto}
                className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition shadow-lg"
              >
                <Check size={16} /> Confirm Face Photo
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={openCamera}
                aria-label={ready ? 'Capture face photo' : 'Open camera'}
                className="grid h-16 w-16 place-items-center rounded-full border-4 border-slate-700 bg-red-600 text-white hover:bg-red-500 transition shadow-xl active:scale-95"
              >
                <Camera size={26} />
              </button>
              <span className="text-[11px] text-slate-400 font-medium">Tap to capture photo</span>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="user"
            onChange={choosePhoto}
            className="hidden"
          />
        </div>
      </section>
    </div>
  )
}
