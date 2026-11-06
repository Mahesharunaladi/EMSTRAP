import { Activity, Bell, ChevronRight, Home, LogOut, Menu, UserRound, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function AppShell({ children, title = 'Overview' }) {
  const { user } = useAuth()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const links = [{ to: '/dashboard/user', label: 'Dashboard', icon: Home }, { to: '/booking', label: 'Book ambulance', icon: Activity }]
  return <div className="app-shell min-h-screen bg-transparent text-black">
    <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/dashboard/user" className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-red-500/15 text-red-400"><Activity size={20} /></span><span className="font-display text-lg font-bold tracking-tight">Em<span className="text-red-400">STraP</span></span></Link>
        <div className="hidden items-center gap-7 md:flex">{links.map(({ to, label, icon: Icon }) => <Link key={to} to={to} className={`flex items-center gap-2 text-sm ${location.pathname === to ? 'text-white' : 'text-slate-400 hover:text-white'}`}><Icon size={16} />{label}</Link>)}</div>
        <div className="flex items-center gap-2"><button className="relative grid h-10 w-10 place-items-center rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white"><Bell size={18} /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-red-400" /></button><button onClick={() => setMenuOpen(!menuOpen)} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-700 bg-slate-900 text-slate-300 md:hidden">{menuOpen ? <X size={18} /> : <Menu size={18} />}</button><div className="hidden items-center gap-2 border-l border-slate-800 pl-3 sm:flex"><div className="grid h-9 w-9 place-items-center rounded-full bg-sky-400/15 text-sm font-bold text-sky-300">AM</div><div className="hidden text-left lg:block"><p className="text-xs font-semibold">{user.name}</p><p className="text-[11px] text-slate-500">Personal account</p></div></div></div>
      </div>
      {menuOpen && <div className="border-t border-slate-800 px-4 py-3 md:hidden">{links.map(({ to, label, icon: Icon }) => <Link onClick={() => setMenuOpen(false)} key={to} to={to} className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-slate-300"><Icon size={17} />{label}<ChevronRight className="ml-auto" size={15} /></Link>)}</div>}
    </header>
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-9">{children}</main>
  </div>
}
