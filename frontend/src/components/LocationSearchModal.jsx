import { Compass, LoaderCircle, MapPin, Search, X } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import api from '../services/api'

export default function LocationSearchModal({ onClose, onSelected }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)

  async function search(event) {
    if (event) event.preventDefault()
    if (query.trim().length < 3) return toast.error('Enter at least 3 characters')
    setLoading(true)
    try {
      const { data } = await api.get(`/location/search?q=${encodeURIComponent(query.trim())}`)
      setResults(data.data || [])
      if (!data.data?.length) toast('No matching addresses found. Try typing a landmark or street.')
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to search this address')
    } finally {
      setLoading(false)
    }
  }

  async function selectLocation(result) {
    setSaving(true)
    try {
      const payload = {
        lat: Number(result.lat),
        lng: Number(result.lng),
        address: result.displayName,
        source: result.source || 'user-selected',
      }
      await api.patch('/auth/location', payload)
      onSelected(payload)
      onClose()
      toast.success('Location updated')
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to save location')
    } finally {
      setSaving(false)
    }
  }

  async function useDeviceGPS() {
    if (!navigator.geolocation) return toast.error('Device GPS is not supported on this browser.')
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const { data } = await api.get(`/location/reverse-geocode?lat=${coords.latitude}&lng=${coords.longitude}`)
          const address = data.data.address || `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`
          await selectLocation({
            lat: coords.latitude,
            lng: coords.longitude,
            displayName: address,
            source: 'browser-gps',
          })
        } catch {
          await selectLocation({
            lat: coords.latitude,
            lng: coords.longitude,
            displayName: `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`,
            source: 'browser-gps',
          })
        } finally {
          setGpsLoading(false)
        }
      },
      (error) => {
        setGpsLoading(false)
        if (error.code === 1) toast.error('Location permission was denied. Please allow location in your browser.')
        else toast.error('Could not get device GPS. Please type and search your address below.')
      },
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 60000 },
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <section className="w-full max-w-[500px] rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-red-600">Select location</p>
            <h2 className="mt-1 font-display text-xl font-bold">Where are you located?</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white hover:bg-slate-50">
            <X size={18} />
          </button>
        </div>

        {/* GPS Quick Action */}
        <button
          disabled={gpsLoading || saving}
          onClick={useDeviceGPS}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50/70 py-3 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
        >
          {gpsLoading ? <LoaderCircle className="animate-spin" size={16} /> : <Compass size={16} />}
          {gpsLoading ? 'Detecting device GPS…' : 'Use current device GPS location'}
        </button>

        <form onSubmit={search} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3.5 text-slate-400" size={17} />
            <input
              autoFocus
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search your area, street, or landmark"
              className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-3 text-sm outline-none focus:border-red-500"
            />
          </div>
          <button disabled={loading || saving} className="grid h-12 w-12 place-items-center rounded-xl bg-slate-950 text-white disabled:opacity-50">
            {loading ? <LoaderCircle className="animate-spin" size={18} /> : <Search size={18} />}
          </button>
        </form>

        <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
          {results.map(result => (
            <button
              key={`${result.lat}-${result.lng}`}
              disabled={saving}
              onClick={() => selectLocation(result)}
              className="flex w-full items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 text-left transition hover:border-red-200 hover:bg-red-50/40"
            >
              <MapPin className="mt-0.5 shrink-0 text-red-600" size={17} />
              <div className="min-w-0 flex-1">
                <span className="text-xs font-medium leading-5 text-slate-800">{result.displayName}</span>
              </div>
            </button>
          ))}
          {!loading && query.length >= 3 && !results.length && (
            <p className="py-5 text-center text-sm text-slate-500">No matching addresses found. Try a broader landmark or city name.</p>
          )}
        </div>

        <p className="mt-4 text-center text-[11px] text-slate-400">
          Your location ensures ambulances and emergency services navigate directly to you.
        </p>
      </section>
    </div>
  )
}
