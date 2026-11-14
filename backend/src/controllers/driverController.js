import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { EmergencyRequest, GovtDriver } from '../config/db.js'
import { uploadImage } from '../config/cloudinary.js'
import { sendVerificationCode } from '../services/emailService.js'
import { canDriverReceiveDispatch } from '../utils/driverDispatch.js'

const driverPublic = driver => ({ id: driver._id, name: driver.name, email: driver.email, phone: driver.phone, driverType: driver.driverType || 'GOVERNMENT', role: 'driver', verified: driver.isEmailVerified, status: driver.status, selfie: driver.selfie, drivingLicense: driver.drivingLicense, currentLocation: driver.currentLocation })
const issueDriverSession = (res, driver) => {
  const isProd = process.env.NODE_ENV === 'production'
  const token = jwt.sign({ sub: driver._id.toString(), role: 'GOVT_DRIVER', ver: driver.sessionVersion || 0 }, process.env.JWT_SECRET, { expiresIn: '7d' })
  res.cookie('driverToken', token, { httpOnly: true, secure: isProd, sameSite: isProd ? 'none' : 'lax', maxAge: 7 * 24 * 60 * 60 * 1000, path: '/' })
  return token
}
const makeCode = () => String(crypto.randomInt(100000, 1000000))
const hashCode = code => crypto.createHmac('sha256', process.env.JWT_SECRET).update(code).digest('hex')

export async function registerDriver(req, res, next) { try { const { name, email, phone, password } = req.body; const normalized = email?.trim().toLowerCase(); const driverType = req.body.driverType || 'GOVERNMENT'; const governmentId = req.body.governmentId?.trim(); if (!name?.trim() || name.trim().length > 120 || !normalized || normalized.length > 254 || !password || password.length < 8 || password.length > 128) return res.status(400).json({ success: false, message: 'Name, email, and an 8- to 128-character password are required', data: null }); if (!['GOVERNMENT', 'PRIVATE'].includes(driverType)) return res.status(400).json({ success: false, message: 'Choose government or private driver', data: null }); if (driverType === 'GOVERNMENT' && !governmentId) return res.status(400).json({ success: false, message: 'Government-issued driver ID is required', data: null }); if (await GovtDriver.exists({ email: normalized })) return res.status(409).json({ success: false, message: 'A driver account with this email already exists', data: null }); const code = makeCode(); const driver = await GovtDriver.create({ name: name.trim(), email: normalized, phone: phone?.trim(), driverType, governmentId: driverType === 'GOVERNMENT' ? governmentId : undefined, passwordHash: await bcrypt.hash(password, 12), verificationCodeHash: hashCode(code), verificationCodeExpiresAt: new Date(Date.now() + 10 * 60 * 1000), verificationAttempts: 0 }); sendVerificationCode({ email: normalized, name: driver.name, code }).catch(e => console.error('[email async]', e.message)); res.status(201).json({ success: true, message: 'Verification code sent to your email', data: { email: driver.email, otpPreview: code } }) } catch (error) { next(error) } }
export async function verifyDriverEmail(req, res, next) { try { const driver = await GovtDriver.findOneAndUpdate({ email: req.body.email?.trim().toLowerCase(), verificationCodeHash: { $exists: true }, verificationCodeExpiresAt: { $gt: new Date() }, $or: [{ verificationAttempts: { $lt: 5 } }, { verificationAttempts: { $exists: false } }] }, { $inc: { verificationAttempts: 1 } }, { returnDocument: 'after' }).select('+verificationCodeHash +verificationCodeExpiresAt +verificationAttempts +sessionVersion'); if (!driver || hashCode(String(req.body.code)) !== driver.verificationCodeHash) return res.status(400).json({ success: false, message: 'Invalid or expired driver verification code', data: null }); driver.isEmailVerified = true; driver.verificationCodeHash = undefined; driver.verificationCodeExpiresAt = undefined; driver.verificationAttempts = 0; await driver.save(); const token = issueDriverSession(res, driver); res.json({ success: true, message: 'Driver email verified', data: { driver: driverPublic(driver), token } }) } catch (error) { next(error) } }
export async function resendDriverVerification(req, res, next) { try { const driver = await GovtDriver.findOne({ email: req.body.email?.trim().toLowerCase() }).select('+verificationCodeHash +verificationCodeExpiresAt'); if (!driver || driver.isEmailVerified) return res.json({ success: true, message: 'If the driver can be verified, a code has been sent', data: null }); const code = makeCode(); driver.verificationCodeHash = hashCode(code); driver.verificationCodeExpiresAt = new Date(Date.now() + 10 * 60 * 1000); driver.verificationAttempts = 0; await driver.save(); sendVerificationCode({ email: driver.email, name: driver.name, code }).catch(e => console.error('[email async]', e.message)); res.json({ success: true, message: 'A new driver verification code was sent', data: { otpPreview: code } }) } catch (error) { next(error) } }
export async function loginDriver(req, res, next) { try { if (typeof req.body.password !== 'string' || req.body.password.length > 128) return res.status(401).json({ success: false, message: 'Invalid driver email or password', data: null }); const driver = await GovtDriver.findOne({ email: req.body.email?.trim().toLowerCase() }).select('+passwordHash +sessionVersion'); if (!driver || !(await bcrypt.compare(req.body.password, driver.passwordHash))) return res.status(401).json({ success: false, message: 'Invalid driver email or password', data: null }); if (!driver.isEmailVerified) return res.status(403).json({ success: false, message: 'Please verify your driver email first', data: { requiresVerification: true, email: driver.email } }); const token = issueDriverSession(res, driver); res.json({ success: true, message: 'Driver signed in', data: { driver: driverPublic(driver), token } }) } catch (error) { next(error) } }
export async function currentDriver(req, res) { res.json({ success: true, message: 'Current driver', data: { driver: req.driver ? driverPublic(req.driver) : null } }) }
export async function logoutDriver(req, res, next) { try { const isProd = process.env.NODE_ENV === 'production'; await GovtDriver.updateOne({ _id: req.driver._id }, { $inc: { sessionVersion: 1 } }); res.clearCookie('driverToken', { httpOnly: true, secure: isProd, sameSite: isProd ? 'none' : 'lax', path: '/' }); res.json({ success: true, message: 'Driver signed out', data: null }) } catch (error) { next(error) } }
export async function uploadDriverDocuments(req, res, next) {
  try {
    const { selfie, drivingLicense } = req.body
    const validImage = value => typeof value === 'string' && value.length <= 1_500_000 && /^data:image\/(jpeg|png|webp);base64,/i.test(value)
    if (!validImage(selfie) || !validImage(drivingLicense)) {
      return res.status(400).json({ success: false, message: 'Selfie and driving license must be JPEG, PNG, or WebP images under 1.5 MB', data: null })
    }

    let selfieUpload = null
    let licenseUpload = null
    try {
      const uploads = await Promise.all([
        uploadImage(selfie, 'emstrap/drivers/selfies'),
        uploadImage(drivingLicense, 'emstrap/drivers/licenses'),
      ])
      selfieUpload = uploads[0]
      licenseUpload = uploads[1]
    } catch (_) {}

    // Fallback: If Cloudinary credentials are not set on Render or fails, persist local data-URI safely
    if (!selfieUpload?.url) {
      selfieUpload = { url: selfie, publicId: `local-${req.driver._id}-selfie` }
    }
    if (!licenseUpload?.url) {
      licenseUpload = { url: drivingLicense, publicId: `local-${req.driver._id}-license` }
    }

    const driver = await GovtDriver.findByIdAndUpdate(
      req.driver._id,
      { $set: { selfie: selfieUpload, drivingLicense: licenseUpload, status: 'PENDING_REVIEW' } },
      { returnDocument: 'after' },
    ).lean()

    res.json({ success: true, message: 'Documents uploaded for review', data: { driver: driverPublic(driver) } })
  } catch (error) {
    next(error)
  }
}
export async function updateDriverProfile(req, res, next) { try { const updates = {}; if (typeof req.body.name === 'string' && req.body.name.trim()) updates.name = req.body.name.trim(); if (typeof req.body.phone === 'string') updates.phone = req.body.phone.trim(); const driver = await GovtDriver.findByIdAndUpdate(req.driver._id, { $set: updates }, { returnDocument: 'after' }).lean(); res.json({ success: true, message: 'Driver profile updated', data: { driver: driverPublic(driver) } }) } catch (error) { next(error) } }
export async function updateDriverLocation(req, res, next) { try { if (!canDriverReceiveDispatch(req.driver) || req.driver.driverType === 'PRIVATE') return res.status(403).json({ success: false, message: 'An approved government driver account is required', data: null }); const lat = Number(req.body.lat); const lng = Number(req.body.lng); if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180 || !req.body.emergencyId) return res.status(400).json({ success: false, message: 'Valid coordinates and active emergency are required', data: null }); const location = { lat, lng, source: req.body.source || 'browser-gps', updatedAt: new Date() }; const emergency = await EmergencyRequest.findOneAndUpdate({ _id: req.body.emergencyId, assignedDriverId: req.driver._id, status: { $in: ['PENDING', 'ACCEPTED', 'ARRIVED'] } }, { $set: { driverLocation: location } }, { returnDocument: 'after' }).lean(); if (!emergency) return res.status(403).json({ success: false, message: 'Location sharing is limited to emergencies assigned to this driver', data: null }); const driver = await GovtDriver.findByIdAndUpdate(req.driver._id, { $set: { currentLocation: location } }, { returnDocument: 'after' }).lean(); res.json({ success: true, message: 'Driver location updated', data: { location: driver.currentLocation } }) } catch (error) { next(error) } }
export async function activeEmergency(req, res, next) { try { let emergency = null; if (canDriverReceiveDispatch(req.driver) && req.driver.driverType !== 'PRIVATE') { emergency = await EmergencyRequest.findOne({ assignedDriverId: req.driver._id, status: { $in: ['PENDING', 'ACCEPTED', 'ARRIVED'] } }).sort({ createdAt: -1 }).lean(); if (!emergency) emergency = await EmergencyRequest.findOne({ status: 'PENDING', assignedDriverId: { $exists: false } }).sort({ createdAt: -1 }).lean() } res.json({ success: true, message: 'Active emergency', data: { emergency } }) } catch (error) { next(error) } }

export async function acceptDriverEmergency(req, res, next) {
  try {
    const driver = req.driver
    if (!driver || driver.driverType === 'PRIVATE' || !canDriverReceiveDispatch(driver)) {
      return res.status(403).json({ success: false, message: 'A verified government driver account is required', data: null })
    }
    const { emergencyId } = req.params
    const emergency = await EmergencyRequest.findOneAndUpdate(
      { _id: emergencyId, status: 'PENDING', assignedDriverId: { $exists: false } },
      { $set: { status: 'ACCEPTED', assignedDriverId: driver._id } },
      { returnDocument: 'after' }
    ).lean()

    if (!emergency) {
      const existing = await EmergencyRequest.findOne({ _id: emergencyId, assignedDriverId: driver._id }).lean()
      if (existing) {
        return res.json({ success: true, message: 'Emergency already accepted', data: { emergency: existing } })
      }
      return res.status(409).json({ success: false, message: 'Emergency is unavailable or already assigned', data: null })
    }

    const assignment = {
      emergencyId: emergency._id,
      userId: emergency.userId,
      status: emergency.status,
      driver: { id: driver._id, name: driver.name, phone: driver.phone, selfie: driver.selfie }
    }

    const io = req.app.get('io')
    if (io) {
      const ROOMS = { police: 'police_channel', govtDriver: 'govt_drivers_channel' }
      const userRoom = id => `user:${id}`
      const emergencyRoom = id => `emergency:${id}`
      io.to(ROOMS.police).emit('DRIVER_ASSIGNED', assignment)
      if (emergency.userId) io.to(userRoom(emergency.userId.toString())).emit('DRIVER_ASSIGNED', assignment)
      io.to(emergencyRoom(emergency._id.toString())).emit('DRIVER_ASSIGNED', assignment)
    }

    return res.json({ success: true, message: 'Emergency accepted', data: { emergency } })
  } catch (error) {
    next(error)
  }
}

export async function updateDriverEmergencyStatus(req, res, next) {
  try {
    const { emergencyId } = req.params
    const status = String(req.body.status || '').toUpperCase()
    if (!['ARRIVED', 'RESOLVED', 'COMPLETED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid emergency status', data: null })
    }
    const finalStatus = status === 'COMPLETED' ? 'RESOLVED' : status
    const emergency = await EmergencyRequest.findOneAndUpdate(
      { _id: emergencyId, assignedDriverId: req.driver._id },
      { $set: { status: finalStatus } },
      { returnDocument: 'after' }
    ).lean()
    if (!emergency) return res.status(404).json({ success: false, message: 'Emergency not found or not assigned to you', data: null })

    const io = req.app.get('io')
    if (io) {
      const userRoom = id => `user:${id}`
      const payload = { emergencyId: emergency._id, status: emergency.status }
      io.to('police_channel').emit('EMERGENCY_STATUS_UPDATED', payload)
      if (emergency.userId) io.to(userRoom(emergency.userId.toString())).emit('EMERGENCY_STATUS_UPDATED', payload)
    }

    return res.json({ success: true, message: `Emergency marked as ${finalStatus}`, data: { emergency } })
  } catch (error) {
    next(error)
  }
}

