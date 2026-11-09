import { Ambulance, Clock3 } from 'lucide-react'
import { Link } from 'react-router-dom'
import MobileAppShell from '../../components/MobileAppShell'
import BookedAmbulanceCard from '../../components/BookedAmbulanceCard'
import useUserBookings from '../../hooks/useUserBookings'

export default function MobileActivityPage() {
  const { bookings, loading, error } = useUserBookings()

  return <MobileAppShell>
    <div className="flex items-end justify-between">
      <div><p className="text-xs font-bold uppercase tracking-[.18em] text-slate-500">Your care</p><h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Activity</h1></div>
      <span className="grid h-10 w-10 place-items-center rounded-full border border-slate-300 bg-white"><Clock3 size={18} /></span>
    </div>

    {loading && <p className="mt-7 text-sm text-slate-500">Loading your ambulance bookings…</p>}
    {error && <p role="alert" className="mt-7 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {!loading && !error && bookings.length === 0 && <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-6 text-center">
      <Ambulance className="mx-auto text-slate-400" size={30} />
      <h2 className="mt-3 font-bold">No ambulance bookings yet</h2>
      <p className="mt-1 text-sm text-slate-500">Your booked rides and driver updates will appear here.</p>
      <Link to="/booking" className="mt-4 inline-flex rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white">Book an ambulance</Link>
    </section>}
    <div className="mt-5 space-y-4">{bookings.map(booking => <BookedAmbulanceCard key={booking._id} booking={booking} />)}</div>
  </MobileAppShell>
}
