import { Ambulance, LockKeyhole, ShieldAlert, ShieldCheck, User } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

export default function AuthLayout({ eyebrow, title, description, children, footer }) {
  const location = useLocation()
  const isDriver = location.pathname.startsWith('/driver')
  const isPolice = location.pathname.startsWith('/police')
  const isUser = !isDriver && !isPolice

  return (
    <main className="auth-app min-h-screen bg-[#f7f7f5] px-4 py-5 text-black">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-[480px] flex-col">
        <header className="flex items-center justify-between px-1 py-2">
          <Link to="/" aria-label="EmSTraP home" className="flex items-center">
            <img src="/emstrap-logo.png" alt="EmSTraP" className="h-12 w-auto" />
          </Link>
          <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
            <LockKeyhole size={13} /> Secure
          </span>
        </header>

        {/* Portal Switcher Tabs */}
        <div className="mt-3 flex items-center justify-center rounded-2xl bg-slate-200/70 p-1 text-xs font-bold text-slate-600">
          <Link
            to="/signin"
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 transition ${isUser ? 'bg-white text-slate-950 shadow-sm' : 'hover:text-slate-900'}`}
          >
            <User size={14} /> Citizen
          </Link>
          <Link
            to="/driver"
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 transition ${isDriver ? 'bg-white text-slate-950 shadow-sm' : 'hover:text-slate-900'}`}
          >
            <Ambulance size={14} /> Driver
          </Link>
          <Link
            to="/police"
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 transition ${isPolice ? 'bg-white text-slate-950 shadow-sm' : 'hover:text-slate-900'}`}
          >
            <ShieldAlert size={14} /> Police
          </Link>
        </div>

        <section className="flex flex-1 flex-col justify-center py-6">
          <div className="mb-6">
            <p className="text-xs font-bold uppercase tracking-[.18em] text-red-600">{eyebrow}</p>
            <h1 className="mt-3 font-display text-[2rem] font-bold leading-tight tracking-tight">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_12px_35px_rgba(15,23,42,.07)] sm:p-6">
            {children}
          </div>
          {footer && <div className="mt-5 text-center text-sm text-slate-600">{footer}</div>}
        </section>

        <footer className="flex items-center justify-center gap-2 pb-3 text-[11px] text-slate-500">
          <ShieldCheck size={14} className="text-emerald-600" /> Your information is protected
        </footer>
      </div>
    </main>
  )
}
