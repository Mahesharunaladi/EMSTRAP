import { ArrowRight, Eye, EyeOff, Mail, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import AuthLayout from '../../components/AuthLayout'
import { useAuth } from '../../context/AuthContext'

export default function SignInPage() {
  const navigate = useNavigate()
  const { signIn } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  async function submit(event) {
    event.preventDefault()
    if (!form.email || !form.password) return toast.error('Enter your email and password')
    setLoading(true)
    try {
      await signIn(form.email, form.password)
      toast.success('Welcome back to EmSTraP')
      navigate('/app', { replace: true })
    } catch (error) {
      if (error.response?.data?.data?.requiresVerification) {
        sessionStorage.setItem('emstrap_pending_verification', JSON.stringify({ email: error.response.data.data.email, name: '' }))
        toast('Please verify your email to continue')
        navigate('/verify-email')
        return
      }
      toast.error(error.response?.data?.message || 'Unable to sign in')
    } finally {
      setLoading(false)
    }
  }

  return <AuthLayout eyebrow="Welcome back" title="Sign in to your account" description="Access your emergency network and manage your ambulance bookings." footer={<>New to EmSTraP? <Link to="/signup" className="font-bold text-red-600 hover:underline">Create an account</Link></>}><form onSubmit={submit} className="space-y-5"><label className="block text-sm font-semibold">Email address<div className="relative mt-2"><Mail className="absolute left-3 top-3.5 text-slate-400" size={17} /><input type="email" autoComplete="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} placeholder="you@example.com" className="w-full rounded-xl border border-slate-300 bg-white px-10 py-3 text-sm text-black outline-none transition placeholder:text-slate-400 focus:border-red-500 focus:ring-4 focus:ring-red-100" /></div></label><label className="block text-sm font-semibold">Password<div className="relative mt-2"><input type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} placeholder="Enter your password" className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 pr-11 text-sm text-black outline-none transition placeholder:text-slate-400 focus:border-red-500 focus:ring-4 focus:ring-red-100" /><button type="button" onClick={() => setShowPassword(!showPassword)} className="!absolute right-2 top-1/2 !h-9 !w-9 -translate-y-1/2 !border-0 !bg-transparent !p-0 text-slate-500" aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label><div className="flex items-center justify-between text-xs"><label className="flex items-center gap-2 text-slate-600"><input type="checkbox" className="h-4 w-4 accent-red-600" /> Remember me</label><span className="font-semibold text-slate-400">Forgot password?</span></div><button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3.5 font-bold text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700 disabled:opacity-60">{loading ? 'Signing in…' : 'Sign in'} {!loading && <ArrowRight size={17} />}</button><div className="flex items-center gap-3 text-xs text-slate-500"><span className="h-px flex-1 bg-slate-200" /> <ShieldCheck size={14} /> Secure access <span className="h-px flex-1 bg-slate-200" /></div></form></AuthLayout>
}
