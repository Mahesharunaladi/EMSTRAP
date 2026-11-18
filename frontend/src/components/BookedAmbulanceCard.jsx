import { Ambulance, MapPin, Navigation, Phone } from 'lucide-react'

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

    {booking.driver && (
      <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50/70 p-3.5 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          {booking.driver.photo ? (
            <img src={booking.driver.photo} alt="Assigned ambulance driver" className="h-12 w-12 rounded-full object-cover border-2 border-white shadow-sm" />
          ) : (
            <span className="grid h-12 w-12 place-items-center rounded-full bg-blue-600 text-white shadow-sm">
              <Ambulance size={20} />
            </span>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold text-slate-900 truncate">{booking.driver.name || 'Driver Assigned'}</p>
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-blue-800">Driver</span>
            </div>
            <p className="text-[11px] text-slate-600 mt-0.5">
              {booking.driver.phone ? `Phone: ${booking.driver.phone}` : 'Private Ambulance Operator'}
            </p>
          </div>
        </div>
        {booking.driver.phone && (
          <a
            href={`tel:${booking.driver.phone}`}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-600/30 hover:bg-emerald-700 transition"
          >
            <Phone size={14} /> Call Driver
          </a>
        )}
      </div>
    )}

    {/* Live Map with Driver's Realtime Position and Movement */}
    {hasCoords(driverLocation) ? (
      <div className="mt-4 space-y-3">
        <div className="overflow-hidden rounded-2xl border border-blue-200 bg-slate-100 shadow-inner">
          <iframe
            title="Live Driver Tracking Map"
            className="h-44 w-full border-0"
            loading="lazy"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(driverLocation.lng) - 0.008}%2C${Number(driverLocation.lat) - 0.008}%2C${Number(driverLocation.lng) + 0.008}%2C${Number(driverLocation.lat) + 0.008}&layer=mapnik&marker=${driverLocation.lat}%2C${driverLocation.lng}`}
          />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3">
          <div>
            <p className="text-xs font-bold text-emerald-900">Driver moving · Live position</p>
            <p className="mt-1 text-[11px] text-emerald-800">{Number(driverLocation.lat).toFixed(5)}, {Number(driverLocation.lng).toFixed(5)}</p>
            <p className="text-[10px] text-emerald-700">Live coordinates refreshing as driver moves</p>
          </div>
          <a
            href={mapsUrl(driverLocation)}
            target="_blank"
            rel="noreferrer"
            aria-label="Open ambulance location in Google Maps"
            className="flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-bold text-white shadow hover:bg-emerald-800"
          >
            <Navigation size={15} /> Open Maps
          </a>
        </div>
      </div>
    ) : booking.status === 'ACCEPTED' || booking.status === 'STARTED' ? (
      <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 border border-amber-200">
        <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
        Driver assigned · Waiting for driver's GPS coordinates to display live map...
      </div>
    ) : null}
  </article>
}
