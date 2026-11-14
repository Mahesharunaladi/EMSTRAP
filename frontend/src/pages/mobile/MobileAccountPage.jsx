import { Ambulance, ChevronRight, CircleHelp, CreditCard, LogOut, MailCheck, MapPin, ShieldAlert, ShieldCheck, UserRound } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import MobileAppShell from '../../components/MobileAppShell'
import { useAuth } from '../../context/AuthContext'

const items = [
  { to: '/app/account/details', label: 'Personal details', detail: 'Name, phone and email', icon: UserRound },
  { to: '/app/account/locations', label: 'Saved locations', detail: 'Manage your frequent places', icon: MapPin },
  { to: '/app/account/payments', label: 'Payments', detail: 'Cards and payment methods', icon: CreditCard },
  { to: '/app/account/safety', label: 'Help and safety', detail: 'Get support when you need it', icon: CircleHelp },
]

export default function MobileAccountPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const logout = async () => {
    await signOut()
    toast.success('You have been signed out')
    navigate('/signin', { replace: true })
  }

  return (
    <MobileAppShell>
      <div className="flex min-w-0 items-center gap-4">
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-slate-950 text-xl font-bold text-white">
          {user?.name?.slice(0, 2).toUpperCase() || 'AM'}
        </span>
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl font-bold">{user?.name || 'Citizen'}</h1>
          <div className="mt-1 flex items-center gap-1 text-xs text-emerald-700">
            <MailCheck size={14} /> Email verified
          </div>
        </div>
      </div>

      {/* Switch Portals Section */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <p className="px-2 pt-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Switch Operational Portals</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Link
            to="/driver"
            className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs font-bold text-slate-800 transition hover:bg-red-50 hover:text-red-700"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-red-100 text-red-600">
              <Ambulance size={16} />
            </span>
            <div>
              <p className="font-bold">Driver Portal</p>
              <p className="text-[10px] text-slate-500 font-normal">Ambulance dispatch</p>
            </div>
          </Link>
          <Link
            to="/police"
            className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs font-bold text-slate-800 transition hover:bg-slate-100 hover:text-slate-950"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-100 text-blue-700">
              <ShieldAlert size={16} />
            </span>
            <div>
              <p className="font-bold">Police Command</p>
              <p className="text-[10px] text-slate-500 font-normal">Emergency tracking</p>
            </div>
          </Link>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        {items.map(({ to, label, detail, icon: Icon }) => (
          <Link key={to} to={to} className="mobile-account-row">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700">
              <Icon size={18} />
            </span>
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-sm font-bold">{label}</span>
              <span className="mt-0.5 block truncate text-xs text-slate-500">{detail}</span>
            </span>
            <ChevronRight size={17} className="shrink-0 text-slate-400" />
          </Link>
        ))}
      </div>

      <div className="mt-7 rounded-2xl bg-slate-950 p-5 text-white">
        <div className="flex items-start gap-3">
          <ShieldCheck size={21} className="shrink-0 text-red-400" />
          <div className="min-w-0">
            <h2 className="text-sm font-bold">Your safety matters</h2>
            <p className="mt-1 text-xs leading-5 text-slate-300">
              Your emergency details are shared only with verified responders when you request help.
            </p>
          </div>
        </div>
      </div>

      <button
        onClick={logout}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-3.5 text-sm font-bold text-red-600"
      >
        <LogOut size={17} /> Sign out
      </button>
    </MobileAppShell>
  )
}
