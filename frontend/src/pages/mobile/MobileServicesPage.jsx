import { Ambulance, Baby, HeartPulse, Siren, Wind } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import MobileAppShell from '../../components/MobileAppShell'
import CameraCaptureModal from '../../components/CameraCaptureModal'
import { dispatchEmergency } from '../../services/emergencySocket'
import { useAuth } from '../../context/AuthContext'
const services = [
  { title: 'Government SOS', detail: 'Immediate emergency response', icon: Siren, tone: 'red' },
  { title: 'Basic', detail: 'Comfortable standard patient transport', icon: Ambulance, tone: 'blue' },
  { title: 'Oxygen', detail: 'Transport with oxygen support', icon: Wind, tone: 'purple' },
  { title: 'ICU', detail: 'Critical care transport and monitoring', icon: HeartPulse, tone: 'amber' },
  { title: 'Pregnancy care', detail: 'Specialized care for expecting mothers', icon: Baby, tone: 'pink' },
]

export default function MobileServicesPage() {
  const { user, currentLocation } = useAuth()
  const [cameraOpen, setCameraOpen] = useState(false)
  const navigate = useNavigate()
  const sos = async payload => {
    await dispatchEmergency({ ...payload, userId: user?.id })
    setCameraOpen(false)
    toast.success('SOS sent to nearby responders')
  }

  return <MobileAppShell>
    <p className="text-xs font-bold uppercase tracking-[.18em] text-slate-500">EmSTraP services</p>
    <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Choose your care</h1>
    <p className="mt-2 text-sm leading-5 text-slate-500">Choose an ambulance equipped for your needs.</p>
    <div className="mt-6 grid grid-cols-2 gap-3">
      {services.map(({ title, detail, icon: Icon, tone }) => {
        const emergency = title === 'Government SOS'
        return <button
          key={title}
          onClick={() => emergency ? setCameraOpen(true) : navigate(`/booking?care=${encodeURIComponent(title)}`)}
          className={`mobile-service-card tone-${tone} ${emergency ? 'col-span-2' : ''}`}
        >
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/80"><Icon size={23} /></span>
          <span className="mt-5 block text-left text-sm font-bold">{title}</span>
          <span className="mt-1 block text-left text-xs leading-4 opacity-70">{detail}</span>
        </button>
      })}
    </div>
    <Link to="/booking" className="mt-5 flex items-center justify-center rounded-xl bg-slate-950 py-3.5 text-sm font-bold text-white">View booking details</Link>
    {cameraOpen && <CameraCaptureModal onClose={() => setCameraOpen(false)} onCaptured={sos} fallbackLocation={currentLocation} />}
  </MobileAppShell>
}
