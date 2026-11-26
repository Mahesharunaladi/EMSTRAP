import { Ambulance, ChevronRight, Clock3, Siren } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import MobileAppShell from '../../components/MobileAppShell'
import BookedAmbulanceCard from '../../components/BookedAmbulanceCard'
import EmergencySosCard from '../../components/EmergencySosCard'
import useUserBookings from '../../hooks/useUserBookings'

const ACTIVE_BOOKING_STATUSES = new Set(['PENDING', 'FINDING_AMBULANCE', 'ACCEPTED', 'ON_THE_WAY', 'ARRIVED', 'STARTED'])

export default function MobileActivityPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = searchParams.get('tab') === 'bookings' ? 'bookings' : 'emergency'
  const [activeTab, setActiveTab] = useState(initialTab)
  const { bookings, emergencies, loading, error } = useUserBookings()

  useEffect(() => {
    const t = searchParams.get('tab')
    if (t === 'bookings' || t === 'emergency') {
      setActiveTab(t)
    }
  }, [searchParams])

  const switchTab = (tab) => {
    setActiveTab(tab)
    setSearchParams({ tab })
  }

  return (
    <MobileAppShell>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-slate-500">Your care</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Activity</h1>
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-full border border-slate-300 bg-white">
          <Clock3 size={18} />
        </span>
      </div>

      {/* Separate History Tabs */}
      <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xs">
        <button
          type="button"
          onClick={() => switchTab('emergency')}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition ${
            activeTab === 'emergency'
              ? 'bg-red-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Siren size={14} />
          <span>Emergency History ({emergencies?.length || 0})</span>
        </button>
        <button
          type="button"
          onClick={() => switchTab('bookings')}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition ${
            activeTab === 'bookings'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Ambulance size={14} />
          <span>Private Booking History ({bookings?.length || 0})</span>
        </button>
      </div>

      {loading && <p className="mt-7 text-sm text-slate-500">Loading your records…</p>}
      {error && <p role="alert" className="mt-7 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}

      {!loading && !error && activeTab === 'emergency' && (
        <div className="mt-5 space-y-4">
          {emergencies && emergencies.length > 0 ? (
            emergencies.map(emergency => (
              <div key={emergency._id || emergency.emergencyId} className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-800">
                    FREE Govt Emergency
                  </span>
                  <Link
                    to={`/emergency/active/${emergency._id || emergency.emergencyId}`}
                    className="text-[11px] font-bold text-red-600 flex items-center gap-0.5"
                  >
                    Open Live View <ChevronRight size={13} />
                  </Link>
                </div>
                <EmergencySosCard emergency={emergency} />
              </div>
            ))
          ) : (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
              <Siren className="mx-auto text-slate-400" size={30} />
              <h2 className="mt-3 font-bold">No emergency SOS history</h2>
              <p className="mt-1 text-sm text-slate-500">Your free government emergency SOS dispatches will appear here.</p>
            </section>
          )}
        </div>
      )}

      {!loading && !error && activeTab === 'bookings' && (
        <div className="mt-5 space-y-4">
          {bookings && bookings.length > 0 ? (
            bookings.map(booking => {
              const isOngoing = ACTIVE_BOOKING_STATUSES.has(booking.status)
              return (
                <div key={booking._id} className="space-y-2">
                  <BookedAmbulanceCard booking={booking} />
                  {isOngoing && (
                    <Link
                      to={`/booking/active/${booking._id}`}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow hover:bg-blue-700 transition"
                    >
                      Open Live Tracking & Driver Chat <ChevronRight size={14} />
                    </Link>
                  )}
                </div>
              )
            })
          ) : (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
              <Ambulance className="mx-auto text-slate-400" size={30} />
              <h2 className="mt-3 font-bold">No private bookings yet</h2>
              <p className="mt-1 text-sm text-slate-500">Your private ambulance bookings and fare receipts will appear here.</p>
              <Link to="/booking" className="mt-4 inline-flex rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white">
                Book an ambulance
              </Link>
            </section>
          )}
        </div>
      )}
    </MobileAppShell>
  )
}
