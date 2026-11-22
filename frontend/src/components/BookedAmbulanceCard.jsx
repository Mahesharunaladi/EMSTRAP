import { Ambulance, Calendar, CheckCircle2, CircleDollarSign, Clock, MapPin, Navigation, Phone, ShieldCheck, UserRound } from 'lucide-react'
import { normalizeCoords } from '../utils/geoUtils'

function formatMoney(amount) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0)
}

function mapsUrl(point) {
  const norm = normalizeCoords(point)
  return norm ? `https://www.google.com/maps?q=${norm.lat},${norm.lng}` : '#'
}

const statusBadges = {
  PENDING: { label: 'Finding Ambulance', color: 'bg-amber-100 text-amber-800' },
  ACCEPTED: { label: 'Ambulance Assigned', color: 'bg-blue-100 text-blue-800' },
  STARTED: { label: 'En Route', color: 'bg-emerald-100 text-emerald-800' },
  COMPLETED: { label: 'Completed', color: 'bg-slate-100 text-slate-700' },
  CANCELLED: { label: 'Cancelled', color: 'bg-red-100 text-red-800' }
}

export default function BookedAmbulanceCard({ booking }) {
  if (!booking) return null

  const pickup = booking.pickupLocation || {}
  const dropoff = booking.dropoffLocation || {}
  const driver = booking.driver || {}
  const driverLocation = normalizeCoords(booking.driverLocation || booking.driver?.currentLocation)
  const badge = statusBadges[booking.status] || { label: booking.status || 'Active', color: 'bg-slate-100 text-slate-800' }

  return <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badge.color}`}>
            {badge.label}
          </span>
          <span className="text-[11px] font-semibold text-slate-400">
            Booking #{String(booking._id || 'booking').slice(-6)}
          </span>
        </div>
        <h3 className="mt-1 font-display text-base font-bold text-slate-900">
          {booking.ambulanceType ? `${booking.ambulanceType} Ambulance` : 'Emergency Ambulance'}
        </h3>
      </div>
      <div className="text-right">
        <p className="font-display text-base font-bold text-slate-900">{formatMoney(booking.totalFare || booking.estimatedFare)}</p>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Fixed rate</p>
      </div>
    </div>

    <div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
      <div className="flex items-start gap-2">
        <MapPin size={14} className="mt-0.5 shrink-0 text-emerald-600" />
        <span className="truncate"><b>From:</b> {pickup.address || pickup.landmark || 'Pickup location'}</span>
      </div>
      <div className="flex items-start gap-2">
        <Navigation size={14} className="mt-0.5 shrink-0 text-red-600" />
        <span className="truncate"><b>To:</b> {dropoff.address || dropoff.landmark || 'Drop-off hospital'}</span>
      </div>
    </div>

    {driver?.name && (
      <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          {driver.photo || driver.selfie?.url ? (
            <img src={driver.photo || driver.selfie?.url} alt="Driver" className="h-9 w-9 rounded-full object-cover border border-slate-300" />
          ) : (
            <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-900 text-white">
              <UserRound size={16} />
            </span>
          )}
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-900 truncate">{driver.name || 'Assigned Driver'}</p>
            <p className="text-[10px] text-slate-500 font-medium">{driver.phone || 'Driver contact protected'}</p>
          </div>
        </div>
        {driver.phone && (
          <a
            href={`tel:${driver.phone}`}
            className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white shadow hover:bg-emerald-700"
          >
            <Phone size={12} /> Call
          </a>
        )}
      </div>
    )}

    {/* Live Driver Movement Map */}
    {driverLocation && (
      <div className="mt-3 space-y-2">
        <div className="overflow-hidden rounded-xl border border-blue-200 bg-slate-100 shadow-inner">
          <iframe
            title="Driver Live Location"
            className="h-36 w-full border-0"
            loading="lazy"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${driverLocation.lng - 0.008}%2C${driverLocation.lat - 0.008}%2C${driverLocation.lng + 0.008}%2C${driverLocation.lat + 0.008}&layer=mapnik&marker=${driverLocation.lat}%2C${driverLocation.lng}`}
          />
        </div>
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          <div>
            <span className="font-bold">Live ambulance position</span>
            <p className="mt-1 text-[11px] text-emerald-800">{driverLocation.lat.toFixed(5)}, {driverLocation.lng.toFixed(5)}</p>
          </div>
          <a
            href={mapsUrl(driverLocation)}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-emerald-800"
          >
            Open Maps
          </a>
        </div>
      </div>
    )}
  </article>
}
