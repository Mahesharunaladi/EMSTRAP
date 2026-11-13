import { Activity, Bell, Map, ShieldAlert, Truck, UserRound } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

const tabs = [{ to: '/driver/dashboard', label: 'Dispatch', icon: Map }, { to: '/driver/profile', label: 'Profile', icon: UserRound }]

export default function DriverAppShell({ children, driver }) {
  const location = useLocation()
  const isGovt = driver?.driverType === 'GOVERNMENT'
  const portalLabel = isGovt ? 'Government Emergency Response' : 'Private Ambulance Operator'
  const roleBadge = isGovt ? 'Govt Emergency Driver' : 'Private Operator'

  return <div className="driver-app min-h-screen bg-[#f7f7f5] text-slate-950">
    <div className="mx-auto min-h-screen w-full max-w-[480px] bg-[#f7f7f5] shadow-xl shadow-slate-200/50">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-[#f7f7f5]/95 px-5 pb-4 pt-4 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <Link to="/driver/dashboard" aria-label="EmSTraP driver home" className="flex items-center">
            <img src="/emstrap-logo.png" alt="EmSTraP" className="h-12 w-auto" />
            <span className={`ml-2 rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm ${isGovt ? 'bg-red-600' : 'bg-slate-900'}`}>
              {roleBadge}
            </span>
          </Link>
          <button className="relative !border-0 !bg-transparent !p-2 text-slate-900">
            <Bell size={20} />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
          </button>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              {isGovt ? <ShieldAlert size={13} className="text-red-600" /> : <Truck size={13} className="text-slate-700" />}
              <p className={`text-[10px] font-bold uppercase tracking-widest ${isGovt ? 'text-red-700' : 'text-slate-700'}`}>
                {portalLabel}
              </p>
            </div>
            <p className="mt-0.5 text-sm font-bold">Hi, {driver?.name?.split(' ')[0] || 'Driver'}</p>
          </div>
          <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> Online
          </span>
        </div>
      </header>
      <main className="min-h-[calc(100vh-142px)] px-5 pb-28 pt-5">{children}</main>
      <nav className="fixed bottom-0 left-1/2 z-40 flex w-[calc(100%-32px)] max-w-[448px] -translate-x-1/2 items-center justify-around rounded-[26px] border border-slate-300 bg-white/95 px-2 py-2 shadow-[0_8px_30px_rgba(15,23,42,.14)] backdrop-blur-xl">
        {tabs.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to
          return <Link key={to} to={to} className={`flex min-w-[100px] flex-col items-center gap-1 rounded-[20px] px-4 py-2 text-[11px] font-semibold ${active ? 'bg-slate-950 text-white' : 'text-slate-500'}`}><Icon size={19} /><span>{label}</span></Link>
        })}
      </nav>
    </div>
  </div>
}
