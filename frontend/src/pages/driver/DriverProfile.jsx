import { ArrowLeft, CheckCircle2, FileCheck2, IdCard, LocateFixed, LogOut, Save, ShieldAlert, Truck, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import DriverAppShell from './DriverAppShell'
import api from '../../services/api'

export default function DriverProfile() {
  const navigate = useNavigate()
  const [driver, setDriver] = useState(null)
  const [form, setForm] = useState({ name: '', phone: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/driver/me')
      .then(({ data }) => {
        setDriver(data.data.driver)
        setForm({ name: data.data.driver.name || '', phone: data.data.driver.phone || '' })
      })
      .catch(() => navigate('/driver'))
  }, [navigate])

  const save = async event => {
    event.preventDefault()
    setSaving(true)
    try {
      const { data } = await api.patch('/driver/profile', form)
      setDriver(data.data.driver)
      toast.success('Driver profile updated')
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to update profile')
    } finally {
      setSaving(false)
    }
  }

  const logout = async () => {
    try { await api.post('/driver/logout') } catch (_) {}
    localStorage.removeItem('emstrap_driver_token')
    sessionStorage.removeItem('emstrap_driver_session')
    navigate('/driver', { replace: true })
  }

  const isGovt = driver?.driverType === 'GOVERNMENT'

  return <DriverAppShell driver={driver}>
    <Link to="/driver/dashboard" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-600">
      <ArrowLeft size={16} /> Dispatch
    </Link>

    <div className="flex items-center gap-4">
      <span className={`grid h-16 w-16 place-items-center rounded-2xl text-xl font-bold text-white shadow-md ${isGovt ? 'bg-red-600 shadow-red-200' : 'bg-slate-900 shadow-slate-200'}`}>
        {isGovt ? <ShieldAlert size={30} /> : <Truck size={30} />}
      </span>
      <div>
        <h1 className="font-display text-2xl font-bold">Driver profile</h1>
        <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-emerald-700">
          <CheckCircle2 size={14} /> Status: {driver?.status || 'Active'}
        </p>
      </div>
    </div>

    {/* Driver Type Identification Card */}
    <div className={`mt-6 rounded-2xl border p-4 shadow-sm ${isGovt ? 'border-red-200 bg-red-50/70' : 'border-blue-200 bg-blue-50/70'}`}>
      <div className="flex items-center justify-between">
        <p className={`text-[11px] font-bold uppercase tracking-wider ${isGovt ? 'text-red-700' : 'text-blue-700'}`}>
          Driver Classification
        </p>
        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white ${isGovt ? 'bg-red-600' : 'bg-blue-600'}`}>
          {isGovt ? 'Government Unit' : 'Private Operator'}
        </span>
      </div>
      <p className="mt-2 text-sm font-bold text-slate-900">
        {isGovt ? 'Official Government Emergency Ambulance' : 'Private Commercial Ambulance Operator'}
      </p>
      <p className="mt-1 text-xs text-slate-600">
        {isGovt
          ? 'Authorized for citizen life-threatening SOS dispatches exclusively. Routine non-emergency rides are bypassed.'
          : 'Authorized for scheduled medical transport & routine patient bookings. Emergency SOS dispatches are routed to government responders.'}
      </p>
      {isGovt && driver?.governmentId && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-200 bg-white p-2.5 text-xs text-red-900">
          <IdCard size={16} className="text-red-600" />
          <span><b>Government ID:</b> {driver.governmentId}</span>
        </div>
      )}
    </div>

    <form onSubmit={save} className="mt-6 space-y-3">
      <label className="driver-profile-field">
        <UserRound size={17} /> Name
        <input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} />
      </label>
      <label className="driver-profile-field">
        <UserRound size={17} /> Phone
        <input type="tel" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} placeholder="Add phone number" />
      </label>
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-xs text-slate-500">Registered email</p>
        <p className="mt-1 break-words text-sm font-bold">{driver?.email || 'Loading…'}</p>
      </div>
      <button disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 py-3.5 text-sm font-bold text-white disabled:opacity-50">
        <Save size={16} /> {saving ? 'Saving…' : 'Save profile'}
      </button>
    </form>

    <section className="mt-6 space-y-3">
      <div className="driver-profile-status">
        <FileCheck2 size={19} className="text-emerald-600" />
        <div>
          <p className="text-sm font-bold">Driving license</p>
          <p className="text-xs text-slate-500">{driver?.drivingLicense ? 'Uploaded & Verified' : 'Uploaded for review'}</p>
        </div>
      </div>
      <div className="driver-profile-status">
        <LocateFixed size={19} className="text-red-600" />
        <div>
          <p className="text-sm font-bold">Location sync status</p>
          <p className="text-xs text-slate-500">{driver?.currentLocation ? `${driver.currentLocation.lat.toFixed(5)}, ${driver.currentLocation.lng.toFixed(5)}` : 'Live sharing enabled upon dispatch'}</p>
        </div>
      </div>
    </section>

    <button onClick={logout} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-3.5 text-sm font-bold text-red-600">
      <LogOut size={17} /> Sign out
    </button>
  </DriverAppShell>
}
