import { Ambulance, MapPin, Navigation } from 'lucide-react'

const statusLabels = {
  PENDING: 'Finding a driver',
  ACCEPTED: 'Driver assigned',
  STARTED: 'Trip in progress',
  COMPLETED: 'Trip completed',
  CANCELLED: 'Booking cancelled',
}

const statusStyles = {
  PENDING: 'bg-amber-100 text-amber-800',
  ACCEPTED: 'bg-blue-100 text-blue-800',
  STARTED: 'bg-emerald-100 text-emerald-800',
  COMPLETED: 'bg-slate-100 text-slate-600',
  CANCELLED: 'bg-red-100 text-red-700',
}

function hasCoords(point) {
  return Number.isFinite(Number(point?.lat)) && Number.isFinite(Number(point?.lng))
}

function mapsUrl(point) {
  return `https://www.google.com/maps?q=${point.lat},${point.lng}`
}

export default function BookedAmbulanceCard({ booking }) {
  const driverLocation = booking.driverLocation
  return <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-start gap-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-red-50 text-red-600"><Ambulance size={21} /></span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-bold">{booking.tier} ambulance</h2>
          <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${statusStyles[booking.status] || statusStyles.PENDING}`}>{statusLabels[booking.status] || booking.status}</span>
        </div>
        <p className="mt-1 text-[11px] text-slate-500">Booking {String(booking._id).slice(-8)}</p>
      </div>
    </div>

    <div className="mt-4 space-y-3 text-xs leading-5 text-slate-700">
      <p className="flex gap-2"><MapPin size={15} className="mt-0.5 shrink-0 text-emerald-600" /><span><b>Pickup:</b> {booking.pickup}</span></p>
      <p className="flex gap-2"><MapPin size={15} className="mt-0.5 shrink-0 text-red-600" /><span><b>Drop-off:</b> {booking.destination}</span></p>
    </div>

    {booking.driver && <div className="mt-4 flex items-center gap-3 rounded-xl bg-slate-50 p-3">
      {booking.driver.photo ? <img src={booking.driver.photo} alt="Assigned ambulance driver" className="h-10 w-10 rounded-full object-cover" /> : <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-slate-500"><Ambulance size={18} /></span>}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-xs font-bold">{booking.driver.name || 'Driver assigned'}</p>
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-blue-800">Private Operator</span>
        </div>
        <p className="text-[11px] text-slate-500">Licensed Medical Transport{booking.driver.phone ? ` · ${booking.driver.phone}` : ''}</p>
      </div>
    </div>}

    {hasCoords(driverLocation) ? <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3">
      <div><p className="text-xs font-bold text-emerald-900">Ambulance location updated</p><p className="mt-1 text-[11px] text-emerald-800">{Number(driverLocation.lat).toFixed(5)}, {Number(driverLocation.lng).toFixed(5)}</p><p className="text-[10px] text-emerald-700">Updates every few seconds while the trip is active</p></div>
      <a href={mapsUrl(driverLocation)} target="_blank" rel="noreferrer" aria-label="Open ambulance location in Maps" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-700 text-white"><Navigation size={17} /></a>
    </div> : booking.status === 'ACCEPTED' || booking.status === 'STARTED' ? <p className="mt-3 text-[11px] text-slate-500">Waiting for the driver’s first location update.</p> : null}
  </article>
}
