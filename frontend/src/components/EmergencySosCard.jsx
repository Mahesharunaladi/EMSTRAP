import { Ambulance, Clock, MapPin, Navigation, PhoneCall, Siren } from 'lucide-react'
import { Link } from 'react-router-dom'
import { normalizeCoords } from '../utils/geoUtils'
import { calculateEta } from '../utils/etaCalculator'

function mapsUrl(point) {
  const norm = normalizeCoords(point)
  return norm ? `https://www.google.com/maps?q=${norm.lat},${norm.lng}` : '#'
}

export default function EmergencySosCard({ emergency }) {
  if (!emergency) return null

  const driver = emergency.driver || {}
  const driverLocation = normalizeCoords(emergency.driverLocation || emergency.driver?.currentLocation)
  const location = normalizeCoords(emergency.location)

  const eta = (driverLocation && location && (emergency.status === 'ACCEPTED' || emergency.status === 'ARRIVED'))
    ? calculateEta(driverLocation, location, 45)
    : null

  const emergencyId = emergency._id || emergency.emergencyId

  return (
    <article className="rounded-2xl border-2 border-red-300 bg-red-50/70 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-red-600 text-white shadow-md shadow-red-200">
          <Siren size={21} className="animate-pulse" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-bold text-red-950">Government Emergency SOS</h2>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${emergency.status === 'ACCEPTED' || emergency.status === 'ARRIVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
              {emergency.status === 'ACCEPTED' ? 'Ambulance En Route' : emergency.status === 'ARRIVED' ? 'On Scene' : 'Alerting Responders'}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            SOS Request #{String(emergencyId || 'active').slice(-8)} · {new Date(emergency.createdAt || Date.now()).toLocaleTimeString()}
          </p>
        </div>
      </div>

      {/* Live ETA Badge */}
      {eta && (
        <div className="mt-3 flex items-center justify-between rounded-xl bg-amber-500/15 p-2.5 border border-amber-300">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-amber-700 animate-pulse" />
            <span className="text-xs font-bold text-amber-950">{eta.badgeText}</span>
          </div>
          <span className="rounded-lg bg-amber-500 px-2.5 py-0.5 text-[10px] font-black text-white">
            {eta.text}
          </span>
        </div>
      )}

      {location && (
        <div className="mt-3 flex items-start gap-2 text-xs text-slate-700 bg-white/80 p-2.5 rounded-xl border border-red-100">
          <MapPin size={15} className="mt-0.5 shrink-0 text-red-600" />
          <span><b>Incident Location:</b> {location.lat.toFixed(5)}, {location.lng.toFixed(5)}</span>
        </div>
      )}

      {emergency.incidentDetails && (
        <p className="mt-2 text-xs text-slate-700 bg-white/80 p-2.5 rounded-xl border border-red-100">
          <span className="font-semibold text-red-900">Notes: </span>{emergency.incidentDetails}
        </p>
      )}

      {/* Driver Contact Card */}
      {(driver?.name || driver?.phone || driver?.photo || driver?.selfie) && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-white p-3 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            {driver.photo || driver.selfie?.url ? (
              <img src={driver.photo || driver.selfie?.url} alt="Assigned driver" className="h-11 w-11 rounded-full object-cover border-2 border-red-200" />
            ) : (
              <span className="grid h-11 w-11 place-items-center rounded-full bg-red-600 text-white">
                <Ambulance size={20} />
              </span>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-bold text-slate-900 truncate">{driver.name || 'Assigned Govt Driver'}</p>
                <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-800">Govt Unit</span>
              </div>
              <p className="text-[11px] text-slate-600 font-medium">{driver.phone ? `Phone: ${driver.phone}` : 'Government Emergency Unit'}</p>
            </div>
          </div>
          {driver.phone && (
            <a
              href={`tel:${driver.phone}`}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-md shadow-emerald-600/30 hover:bg-emerald-700 transition"
            >
              <PhoneCall size={13} /> Call Driver
            </a>
          )}
        </div>
      )}

      {/* Live Driver Movement Map */}
      {driverLocation ? (
        <div className="mt-3 space-y-2">
          <div className="overflow-hidden rounded-2xl border border-red-200 bg-slate-100 shadow-inner">
            <iframe
              title="Live Emergency Ambulance Tracking"
              className="h-44 w-full border-0"
              loading="lazy"
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${driverLocation.lng - 0.008}%2C${driverLocation.lat - 0.008}%2C${driverLocation.lng + 0.008}%2C${driverLocation.lat + 0.008}&layer=mapnik&marker=${driverLocation.lat}%2C${driverLocation.lng}`}
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-2.5">
            <div>
              <p className="text-xs font-bold text-emerald-900">Ambulance moving · Live GPS</p>
              <p className="text-[10px] text-emerald-700">{driverLocation.lat.toFixed(5)}, {driverLocation.lng.toFixed(5)}</p>
            </div>
            <a
              href={mapsUrl(driverLocation)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-emerald-800"
            >
              <Navigation size={14} /> Open Maps
            </a>
          </div>
        </div>
      ) : emergency.status === 'ACCEPTED' ? (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 p-2.5 text-xs text-amber-800 border border-amber-200">
          <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
          Driver accepted! Connecting ambulance live GPS map...
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/80 p-2.5 text-xs text-slate-600 border border-slate-200">
          <span className="h-2 w-2 rounded-full bg-red-600 animate-pulse" />
          Alerting nearest government ambulance units & police command...
        </div>
      )}

      {emergencyId && (
        <Link
          to={`/emergency/active/${emergencyId}`}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white shadow hover:bg-slate-800"
        >
          Open Incident Command & Evidence Page
        </Link>
      )}
    </article>
  )
}
