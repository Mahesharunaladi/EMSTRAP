import { Camera, Check, Eye, RotateCcw, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'

/**
 * Crops and compresses specifically the eye / ocular region from the video element or uploaded photo.
 * Ensures the output image represents the horizontal periocular band (aspect ratio ~2.4:1).
 */
function cropEyeRegion(source, srcWidth, srcHeight) {
  const cropW = Math.round(srcWidth * 0.82)
  const cropH = Math.round(cropW / 2.4)
  const cropX = Math.round((srcWidth - cropW) / 2)
  const cropY = Math.round((srcHeight - cropH) * 0.42)

  const targetW = Math.min(720, cropW)
  const targetH = Math.round(targetW / 2.4)

  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d')

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, cropX, cropY, cropW, cropH, 0, 0, targetW, targetH)

  return canvas.toDataURL('image/jpeg', 0.85)
}

function fileToEyeJpeg(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('That photo could not be read.'))
    reader.onload = () => {
      const image = new Image()
      image.onerror = () => reject(new Error('That photo could not be opened.'))
      image.onload = () => resolve(cropEyeRegion(image, image.naturalWidth, image.naturalHeight))
      image.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

export default function DriverCameraModal({
  onClose,
  onCaptured,
  title = 'Driver Eye Verification',
  subtitle = 'Ocular Biometric Check',
  instructions = 'Align ONLY your eyes inside the frame'
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
      video: {
        facingMode: 'user',
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
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
    const eyePhoto = cropEyeRegion(video, video.videoWidth, video.videoHeight)
    setPreview(eyePhoto)
  }

  const chooseEyePhoto = async event => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Choose an image file for eye verification.')
      return
    }
    try {
      setPreview(await fileToEyeJpeg(file))
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
      <section className="w-full max-w-[460px] overflow-hidden rounded-3xl border border-slate-700/80 bg-slate-900 text-white shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-red-500/20 text-red-400">
              <Eye size={18} />
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

        {/* Viewfinder Window */}
        <div className="relative aspect-[4/3] bg-black overflow-hidden flex items-center justify-center">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            onCanPlay={() => setReady(true)}
            className={`h-full w-full object-cover ${preview || !ready ? 'hidden' : ''}`}
          />
          {preview && (
            <div className="flex flex-col items-center justify-center p-4 w-full h-full bg-slate-950">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <Check size={14} /> Captured Eye Biometric Region
              </p>
              <img
                src={preview}
                alt="Eye Biometric Region Preview"
                className="w-full max-h-36 rounded-xl border-2 border-emerald-500/80 object-cover shadow-lg"
              />
              <p className="mt-2 text-center text-xs text-slate-400">
                Aspect ratio verified. Ensure pupil and periocular details are clear.
              </p>
            </div>
          )}

          {!preview && !ready && (
            <div className="absolute inset-0 grid place-items-center px-8 text-center text-sm text-white/80">
              Starting secure camera… Or tap the button below.
            </div>
          )}

          {/* Guided Eye-Alignment Viewfinder Box */}
          {!preview && ready && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              {/* Darkened mask around the eye box */}
              <div className="relative w-[84%] aspect-[2.4/1] rounded-2xl border-2 border-dashed border-red-400 bg-red-500/5 shadow-[0_0_0_9999px_rgba(2,6,23,0.55)] flex items-center justify-center">
                {/* Horizontal sightline */}
                <div className="absolute left-2 right-2 h-px bg-red-400/40 border-t border-dashed border-red-300" />
                {/* Corner markers */}
                <div className="absolute -top-1 -left-1 h-3 w-3 border-t-2 border-l-2 border-red-400 rounded-tl-sm" />
                <div className="absolute -top-1 -right-1 h-3 w-3 border-t-2 border-r-2 border-red-400 rounded-tr-sm" />
                <div className="absolute -bottom-1 -left-1 h-3 w-3 border-b-2 border-l-2 border-red-400 rounded-bl-sm" />
                <div className="absolute -bottom-1 -right-1 h-3 w-3 border-b-2 border-r-2 border-red-400 rounded-br-sm" />

                <span className="absolute -top-6 rounded-full bg-red-500/80 px-2 py-0.5 text-[10px] font-bold tracking-wider text-white uppercase">
                  Eye Alignment Zone
                </span>
              </div>
              <p className="mt-6 text-center text-xs font-semibold text-white drop-shadow-md px-4">
                {instructions}
              </p>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-center gap-5 p-4 border-t border-slate-800 bg-slate-900/90">
          {preview ? (
            <>
              <button
                onClick={() => setPreview(null)}
                aria-label="Retake eye photo"
                className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-700 transition"
              >
                <RotateCcw size={15} /> Retake
              </button>
              <button
                onClick={usePhoto}
                className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition shadow-lg shadow-emerald-500/20"
              >
                <Check size={16} /> Confirm Eye Photo
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={openCamera}
                aria-label={ready ? 'Capture eye region' : 'Open camera'}
                className="grid h-16 w-16 place-items-center rounded-full border-4 border-slate-700 bg-red-600 text-white hover:bg-red-500 transition shadow-xl active:scale-95"
              >
                <Camera size={26} />
              </button>
              <span className="text-[11px] text-slate-400 font-medium">Tap to capture eyes</span>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="user"
            onChange={chooseEyePhoto}
            className="hidden"
          />
        </div>
      </section>
    </div>
  )
}
