import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { User } from '../config/db.js'
import { sendVerificationCode } from '../services/emailService.js'
import { updateCurrentLocation } from './locationController.js'

const OTP_TTL_MS = 10 * 60 * 1000
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000
const publicUser = user => ({ id: user._id, name: user.name, email: user.email, role: user.role.toLowerCase(), verified: user.isEmailVerified, currentLocation: user.currentLocation || null })
const hashCode = value => crypto.createHash('sha256').update(value).digest('hex')
const createCode = () => String(crypto.randomInt(100000, 1000000))

function issueSession(res, user) {
  const token = jwt.sign({ sub: user._id.toString(), role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' })
  res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: COOKIE_MAX_AGE, path: '/' })
}

export async function register(req, res, next) {
  try {
    const { name, email, password } = req.body
    const normalizedEmail = email?.trim().toLowerCase()
    if (!name?.trim() || !normalizedEmail || !password || password.length < 8) return res.status(400).json({ success: false, message: 'Name, valid email, and an 8-character password are required', data: null })
    let user = await User.findOne({ email: normalizedEmail }).select('+passwordHash +verificationCodeHash +verificationCodeExpiresAt')
    if (user?.isEmailVerified) return res.status(409).json({ success: false, message: 'An account with this email already exists', data: null })
    const code = createCode()
    const fields = { name: name.trim(), email: normalizedEmail, passwordHash: await bcrypt.hash(password, 12), isEmailVerified: false, verificationCodeHash: hashCode(code), verificationCodeExpiresAt: new Date(Date.now() + OTP_TTL_MS) }
    user = user ? Object.assign(user, fields) : new User(fields)
    await user.save()
    await sendVerificationCode({ email: normalizedEmail, name: user.name, code })
    res.status(201).json({ success: true, message: 'Verification code sent to your email', data: { email: user.email, expiresInSeconds: OTP_TTL_MS / 1000 } })
  } catch (error) { next(error) }
}

export async function verifyEmail(req, res, next) {
  try {
    const { email, code } = req.body
    const user = await User.findOne({ email: email?.trim().toLowerCase() }).select('+verificationCodeHash +verificationCodeExpiresAt')
    if (!user || !user.verificationCodeHash || user.verificationCodeExpiresAt < new Date() || hashCode(String(code)) !== user.verificationCodeHash) return res.status(400).json({ success: false, message: 'Invalid or expired verification code', data: null })
    user.isEmailVerified = true; user.verificationCodeHash = undefined; user.verificationCodeExpiresAt = undefined
    await user.save(); issueSession(res, user)
    res.json({ success: true, message: 'Email verified successfully', data: { user: publicUser(user) } })
  } catch (error) { next(error) }
}

export async function resendVerification(req, res, next) {
  try {
    const user = await User.findOne({ email: req.body.email?.trim().toLowerCase() }).select('+verificationCodeHash +verificationCodeExpiresAt')
    if (!user || user.isEmailVerified) return res.json({ success: true, message: 'If the account can be verified, a code has been sent', data: null })
    const code = createCode(); user.verificationCodeHash = hashCode(code); user.verificationCodeExpiresAt = new Date(Date.now() + OTP_TTL_MS); await user.save(); await sendVerificationCode({ email: user.email, name: user.name, code })
    res.json({ success: true, message: 'A new verification code was sent', data: { expiresInSeconds: OTP_TTL_MS / 1000 } })
  } catch (error) { next(error) }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body
    const user = await User.findOne({ email: email?.trim().toLowerCase() }).select('+passwordHash')
    if (!user || !(await bcrypt.compare(password || '', user.passwordHash))) return res.status(401).json({ success: false, message: 'Invalid email or password', data: null })
    if (!user.isEmailVerified) return res.status(403).json({ success: false, message: 'Please verify your email before signing in', data: { requiresVerification: true, email: user.email } })
    issueSession(res, user); res.json({ success: true, message: 'Signed in successfully', data: { user: publicUser(user) } })
  } catch (error) { next(error) }
}

export async function currentUser(req, res) { res.json({ success: true, message: 'Current user', data: { user: publicUser(req.user) } }) }
export function logout(_req, res) { res.clearCookie('token', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' }); res.json({ success: true, message: 'Signed out successfully', data: null }) }
export { updateCurrentLocation }
