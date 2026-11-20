import { ArrowRight, Check, Eye, EyeOff, Lock, Mail, Phone, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import AuthLayout from '../../components/AuthLayout'
import { useAuth } from '../../context/AuthContext'

export default function SignUpPage() {
  const navigate = useNavigate()
  const { startSignUp } = useAuth()
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', consent: false })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  async function submit(event) {
    event.preventDefault()
    if (!form.name || !form.email || form.password.length < 8) {
      return toast.error('Use your name, email, and an 8-character password')
    }
    const digits = form.phone.replace(/\D/g, '')
    if (digits.length !== 10 || !/^[6-9]/.test(digits)) {
      return toast.error('Please enter a valid 10-digit Indian phone number starting with 6-9')
    }
    const cleanPhone = `+91${digits}`
    if (!form.consent) return toast.error('Please accept the terms to continue')
    
    setLoading(true)
    try {
      await startSignUp(form.name, form.email, form.password, cleanPhone)
      toast.success('Verification code sent to your email')
      navigate('/verify-email')
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to create account')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      eyebrow="Get started"
      title="Create your account"
      description="Join a safer, faster way to coordinate emergency medical care."
      footer={<>Already have an account? <Link to="/signin" className="font-bold text-red-600 hover:underline">Sign in</Link></>}
    >
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm font-semibold">
          Full name
          <div className="relative mt-2">
            <UserRound className="absolute left-3 top-3.5 text-slate-400" size={17} />
            <input
              required
              value={form.name}
              onChange={event => setForm({ ...form, name: event.target.value })}
              placeholder="Alex Morgan"
              className="w-full rounded-xl border border-slate-300 bg-white px-10 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-red-500 focus:ring-4 focus:ring-red-100"
            />
          </div>
        </label>

        <label className="block text-sm font-semibold">
          Email address
          <div className="relative mt-2">
            <Mail className="absolute left-3 top-3.5 text-slate-400" size={17} />
            <input
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={event => setForm({ ...form, email: event.target.value })}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-slate-300 bg-white px-10 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-red-500 focus:ring-4 focus:ring-red-100"
            />
          </div>
        </label>

        <label className="block text-sm font-semibold">
          <div className="flex items-center justify-between">
            <span>Mobile Phone Number</span>
            <span className="flex items-center gap-1 text-[11px] font-bold text-red-600">
              <Lock size={12} /> 10-Digit Mobile · Permanent
            </span>
          </div>
          <div className="relative mt-2 flex items-center">
            <div className="flex items-center gap-1.5 border border-r-0 border-slate-300 bg-slate-100 px-3 py-3 rounded-l-xl text-sm font-bold text-slate-700 select-none">
              <Phone size={15} className="text-slate-500" />
              <span>+91</span>
            </div>
            <input
              type="tel"
              required
              autoComplete="tel"
              maxLength={10}
              value={form.phone}
              onChange={event => {
                const digits = event.target.value.replace(/\D/g, '').slice(0, 10);
                setForm({ ...form, phone: digits });
              }}
              placeholder="9876543210"
              className="w-full rounded-r-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold outline-none transition placeholder:text-slate-400 focus:border-red-500 focus:ring-4 focus:ring-red-100"
            />
          </div>
          <p className="mt-1.5 text-[11px] leading-4 text-slate-500">
            Enter exactly 10 digits (starting with 6, 7, 8, or 9). This phone number is bound to your emergency record permanently.
          </p>
        </label>

        <label className="block text-sm font-semibold">
          Create password
          <div className="relative mt-2">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="new-password"
              value={form.password}
              onChange={event => setForm({ ...form, password: event.target.value })}
              placeholder="At least 8 characters"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 pr-11 text-sm outline-none transition placeholder:text-slate-400 focus:border-red-500 focus:ring-4 focus:ring-red-100"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="!absolute right-2 top-1/2 !h-9 !w-9 -translate-y-1/2 !border-0 !bg-transparent !p-0 text-slate-500"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </label>

        <label className="flex items-start gap-2 text-xs leading-5 text-slate-600">
          <input
            type="checkbox"
            checked={form.consent}
            onChange={event => setForm({ ...form, consent: event.target.checked })}
            className="mt-1 h-4 w-4 shrink-0 accent-red-600"
          />
          I agree to the EmSTraP terms and confirm this phone number will be used to coordinate my emergency dispatch.
        </label>

        <button
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3.5 font-bold text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700 disabled:opacity-60"
        >
          {loading ? 'Creating account…' : 'Create account'} {!loading && <ArrowRight size={17} />}
        </button>

        <p className="flex items-center justify-center gap-2 text-xs text-slate-500">
          <Check size={14} className="text-emerald-600" /> Phone and email verification protect your account
        </p>
      </form>
    </AuthLayout>
  )
}
