import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { AmbulanceBooking, BookingUser, User } from '../config/db.js'
import { sendVerificationCode } from '../services/emailService.js'
import { updateCurrentLocation } from './locationController.js'

const OTP_TTL_MS = 10 * 60 * 1000
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000
const publicUser = user => ({ id: user._id, name: user.name, email: user.email, role: user.role.toLowerCase(), verified: user.isEmailVerified, currentLocation: user.currentLocation || null })
const hashCode = value => crypto.createHmac('sha256', process.env.JWT_SECRET).update(value).digest('hex')
const createCode = () => String(crypto.randomInt(100000, 1000000))

function issueSession(res, user) {
  const token = jwt.sign({ sub: user._id.toString(), role: user.role, ver: user.sessionVersion || 0 }, process.env.JWT_SECRET, { expiresIn: '7d' })
  const isProd = process.env.NODE_ENV === 'production'
  res.cookie('token', token, { httpOnly: true, secure: isProd, sameSite: isProd ? 'none' : 'lax', maxAge: COOKIE_MAX_AGE, path: '/' })
}

export async function register(req, res, next) {
  try {
    const { name, email, password } = req.body
    const normalizedEmail = email?.trim().toLowerCase()
    if (!name?.trim() || name.trim().length > 120 || !normalizedEmail || normalizedEmail.length > 254 || !password || password.length < 8 || password.length > 128) return res.status(400).json({ success: false, message: 'Name, valid email, and an 8- to 128-character password are required', data: null })
    let user = await User.findOne({ email: normalizedEmail }).select('+passwordHash +verificationCodeHash +verificationCodeExpiresAt +sessionVersion')
    if (user?.isEmailVerified) return res.status(409).json({ success: false, message: 'An account with this email already exists', data: null })
    const code = createCode()
    const fields = { name: name.trim(), email: normalizedEmail, passwordHash: await bcrypt.hash(password, 12), isEmailVerified: false, verificationCodeHash: hashCode(code), verificationCodeExpiresAt: new Date(Date.now() + OTP_TTL_MS), verificationAttempts: 0 }
    user = user ? Object.assign(user, fields) : new User(fields)
    await user.save()
    await sendVerificationCode({ email: normalizedEmail, name: user.name, code })
    res.status(201).json({ success: true, message: 'Verification code sent to your email', data: { email: user.email, expiresInSeconds: OTP_TTL_MS / 1000 } })
  } catch (error) { next(error) }
}

export async function verifyEmail(req, res, next) {
  try {
    const { email, code } = req.body
    const user = await User.findOneAndUpdate({ email: email?.trim().toLowerCase(), verificationCodeHash: { $exists: true }, verificationCodeExpiresAt: { $gt: new Date() }, $or: [{ verificationAttempts: { $lt: 5 } }, { verificationAttempts: { $exists: false } }] }, { $inc: { verificationAttempts: 1 } }, { returnDocument: 'after' }).select('+verificationCodeHash +verificationCodeExpiresAt +verificationAttempts +sessionVersion')
    if (!user || hashCode(String(code)) !== user.verificationCodeHash) return res.status(400).json({ success: false, message: 'Invalid or expired verification code', data: null })
    user.isEmailVerified = true; user.verificationCodeHash = undefined; user.verificationCodeExpiresAt = undefined; user.verificationAttempts = 0
    await user.save(); issueSession(res, user)
    res.json({ success: true, message: 'Email verified successfully', data: { user: publicUser(user) } })
  } catch (error) { next(error) }
}

export async function resendVerification(req, res, next) {
  try {
    const user = await User.findOne({ email: req.body.email?.trim().toLowerCase() }).select('+verificationCodeHash +verificationCodeExpiresAt')
    if (!user || user.isEmailVerified) return res.json({ success: true, message: 'If the account can be verified, a code has been sent', data: null })
    const code = createCode(); user.verificationCodeHash = hashCode(code); user.verificationCodeExpiresAt = new Date(Date.now() + OTP_TTL_MS); user.verificationAttempts = 0; await user.save(); await sendVerificationCode({ email: user.email, name: user.name, code })
    res.json({ success: true, message: 'A new verification code was sent', data: { expiresInSeconds: OTP_TTL_MS / 1000 } })
  } catch (error) { next(error) }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body
    if (typeof password !== 'string' || password.length > 128) return res.status(401).json({ success: false, message: 'Invalid email or password', data: null })
    const user = await User.findOne({ email: email?.trim().toLowerCase() }).select('+passwordHash +sessionVersion')
    if (!user || !(await bcrypt.compare(password || '', user.passwordHash))) return res.status(401).json({ success: false, message: 'Invalid email or password', data: null })
    if (!user.isEmailVerified) return res.status(403).json({ success: false, message: 'Please verify your email before signing in', data: { requiresVerification: true, email: user.email } })
    issueSession(res, user); res.json({ success: true, message: 'Signed in successfully', data: { user: publicUser(user) } })
  } catch (error) { next(error) }
}

export async function currentUser(req, res) { res.json({ success: true, message: 'Current user', data: { user: publicUser(req.user) } }) }
export async function logout(req, res, next) { try { const isProd = process.env.NODE_ENV === 'production'; await User.updateOne({ _id: req.user._id }, { $inc: { sessionVersion: 1 } }); res.clearCookie('token', { httpOnly: true, secure: isProd, sameSite: isProd ? 'none' : 'lax', path: '/' }); res.json({ success: true, message: 'Signed out successfully', data: null }) } catch (error) { next(error) } }
export { updateCurrentLocation }

export async function updateProfile(req, res, next) {
  try {
    const updates = {}
    if (typeof req.body.name === 'string' && req.body.name.trim()) updates.name = req.body.name.trim()
    if (typeof req.body.phone === 'string') updates.phone = req.body.phone.trim()
    const user = await User.findByIdAndUpdate(req.user._id, { $set: updates }, { returnDocument: 'after', runValidators: true }).lean()
    res.json({ success: true, message: 'Profile updated', data: { user: publicUser(user) } })
  } catch (error) { next(error) }
}

async function findBookingUser(email) { return BookingUser.findOne({ email }).select('_id').lean() }

export async function rideHistory(req, res, next) {
  try {
    const bookingUser = await findBookingUser(req.user.email)
    const rides = bookingUser ? await AmbulanceBooking.find({ userId: bookingUser._id }).sort({ createdAt: -1 }).lean() : []
    res.json({ success: true, message: 'Ride history', data: { rides } })
  } catch (error) { next(error) }
}

export async function billingHistory(req, res, next) {
  try {
    const bookingUser = await findBookingUser(req.user.email)
    const payments = bookingUser ? await AmbulanceBooking.find({ userId: bookingUser._id }).select('tier price paymentStatus status createdAt pickup destination').sort({ createdAt: -1 }).lean() : []
    res.json({ success: true, message: 'Billing history', data: { payments } })
  } catch (error) { next(error) }
}
