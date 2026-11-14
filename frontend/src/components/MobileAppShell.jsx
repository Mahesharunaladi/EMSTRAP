import { Activity, Ambulance, Bell, CheckCircle2, Grid2X2, Home, MapPin, Search, ShieldAlert, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import LocationSearchModal from './LocationSearchModal'

const tabs = [
  { to: '/app', label: 'Home', icon: Home },
  { to: '/app/services', label: 'Services', icon: Grid2X2 },
  { to: '/app/activity', label: 'Activity', icon: Activity },
  { to: '/app/account', label: 'Account', icon: UserRound },
]

export default function MobileAppShell({ children }) {
  const location = useLocation()
  const { user, currentLocation, locationStatus, updateLocation } = useAuth()
  const [searchOpen, setSearchOpen] = useState(false)

  const currentAddress =
    currentLocation?.address ||
    user?.currentLocation?.address ||
    (currentLocation ? `${currentLocation.lat.toFixed(4)}, ${currentLocation.lng.toFixed(4)}` : (locationStatus === 'live' || locationStatus === 'located' ? 'Live location detected' : 'Detecting your location…'))

  const statusText = {
    starting: 'Starting GPS…',
    locating: 'Finding you…',
    live: 'Location active',
    permission: 'Tap to set address',
    fallback: 'Getting location…',
    approximate: 'Tap to change location',
    unavailable: 'Tap to set location',
    unsupported: 'Tap to search address',
    error: 'Tap to set location',
    'signed-out': 'Sign in for location',
  }[locationStatus] || 'Tap to change'

  const statusClass = locationStatus === 'live' ? 'is-live' : ['error', 'permission', 'unavailable', 'unsupported'].includes(locationStatus) ? 'is-error' : ''

  return (
    <div className="mobile-app min-h-screen bg-[#f7f7f5] text-slate-950">
      <div className="mx-auto min-h-screen w-full bg-[#f7f7f5] shadow-xl shadow-slate-200/50">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-[#f7f7f5]/95 px-5 pb-3 pt-4 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-red-100 text-red-600">
                <MapPin size={16} fill="currentColor" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Your location</p>
                <button
                  onClick={() => setSearchOpen(true)}
                  title="Change location"
                  className="flex max-w-[260px] items-center gap-1 truncate !border-0 !bg-transparent !p-0 text-sm font-bold text-slate-900 transition hover:text-red-600"
                >
                  <span className="truncate">{currentAddress}</span>
                  <span className="text-slate-400">⌄</span>
                </button>
                <button
                  onClick={() => setSearchOpen(true)}
                  className={`mobile-location-status ${statusClass} cursor-pointer`}
                >
                  {locationStatus === 'live' ? <CheckCircle2 size={11} /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                  {statusText}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Link
                to="/driver"
                title="Open Driver Portal"
                className="flex items-center gap-1 rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm transition hover:bg-slate-800"
              >
                <Ambulance size={13} className="text-red-400" /> Driver
              </Link>
              <Link
                to="/police"
                title="Open Police Portal"
                className="flex items-center gap-1 rounded-full bg-blue-900 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm transition hover:bg-blue-800"
              >
                <ShieldAlert size={13} className="text-blue-300" /> Police
              </Link>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <Link to="/app" aria-label="EmSTraP home" className="flex items-center">
              <img src="/emstrap-logo.png" alt="EmSTraP" className="h-11 w-auto" />
            </Link>
            <p className="text-xs font-medium text-slate-500">Hi, {user?.name?.split(' ')[0] || 'there'} 👋</p>
          </div>
        </header>

        <main className="min-h-[calc(100vh-142px)] px-5 pb-28 pt-5">{children}</main>

        <nav className="fixed bottom-0 left-1/2 z-40 flex w-[calc(100%-32px)] max-w-[448px] -translate-x-1/2 items-center justify-around rounded-[26px] border border-slate-300 bg-white/95 px-2 py-2 shadow-[0_8px_30px_rgba(15,23,42,.14)] backdrop-blur-xl md:max-w-[688px]">
          {tabs.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to
            return (
              <Link
                key={to}
                to={to}
                className={`flex min-w-[68px] flex-col items-center gap-1 rounded-[20px] px-3 py-2 text-[11px] font-semibold transition ${active ? 'bg-slate-950 text-white' : 'text-slate-500 hover:text-slate-900'}`}
              >
                <Icon size={19} strokeWidth={active ? 2.5 : 2} />
                <span>{label}</span>
              </Link>
            )
          })}
        </nav>

        {searchOpen && (
          <LocationSearchModal
            onClose={() => setSearchOpen(false)}
            onSelected={result => updateLocation(result)}
          />
        )}
      </div>
    </div>
  )
}
