import { ArrowRight, Check, Eye, EyeOff, Mail, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import AuthLayout from '../../components/AuthLayout'
import { useAuth } from '../../context/AuthContext'

export default function SignUpPage() {
  const navigate = useNavigate()
  const { startSignUp } = useAuth()
  const [form, setForm] = useState({ name: '', email: '', password: '', consent: false })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  async function submit(event) {
    event.preventDefault()
    if (!form.name || !form.email || form.password.length < 8) return toast.error('Use your name, email, and an 8-character password')
    if (!form.consent) return toast.error('Please accept the terms to continue')
    setLoading(true)
    try { await startSignUp(form.name, form.email, form.password); toast.success('Verification code sent to your email'); navigate('/verify-email') } catch (error) { toast.error(error.response?.data?.message || 'Unable to create account') } finally { setLoading(false) }
  }

  return <AuthLayout eyebrow="Get started" title="Create your account" description="Join a safer, faster way to coordinate emergency medical care." footer={<>Already have an account? <Link to="/signin" className="font-bold text-red-600 hover:underline">Sign in</Link></>}><form onSubmit={submit} className="space-y-4"><label className="block text-sm font-semibold">Full name<div className="relative mt-2"><UserRound className="absolute left-3 top-3.5 text-slate-400" size={17} /><input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Alex Morgan" className="w-full rounded-xl border border-slate-300 bg-white px-10 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-red-500 focus:ring-4 focus:ring-red-100" /></div></label><label className="block text-sm font-semibold">Email address<div className="relative mt-2"><Mail className="absolute left-3 top-3.5 text-slate-400" size={17} /><input type="email" autoComplete="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} placeholder="you@example.com" className="w-full rounded-xl border border-slate-300 bg-white px-10 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-red-500 focus:ring-4 focus:ring-red-100" /></div></label><label className="block text-sm font-semibold">Create password<div className="relative mt-2"><input type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} placeholder="At least 8 characters" className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 pr-11 text-sm outline-none transition placeholder:text-slate-400 focus:border-red-500 focus:ring-4 focus:ring-red-100" /><button type="button" onClick={() => setShowPassword(!showPassword)} className="!absolute right-2 top-1/2 !h-9 !w-9 -translate-y-1/2 !border-0 !bg-transparent !p-0 text-slate-500">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label><label className="flex items-start gap-2 text-xs leading-5 text-slate-600"><input type="checkbox" checked={form.consent} onChange={event => setForm({ ...form, consent: event.target.checked })} className="mt-1 h-4 w-4 shrink-0 accent-red-600" />I agree to the EmSTraP terms and understand how my emergency data is used.</label><button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3.5 font-bold text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700 disabled:opacity-60">{loading ? 'Creating account…' : 'Create account'} {!loading && <ArrowRight size={17} />}</button><p className="flex items-center justify-center gap-2 text-xs text-slate-500"><Check size={14} className="text-emerald-600" /> Email verification protects your account</p></form></AuthLayout>
}
