import jwt from 'jsonwebtoken'
import { EmergencyAlert, EmergencyRequest, GovtDriver, User } from '../config/db.js'
import { uploadImage } from '../config/cloudinary.js'
import { allowedOrigins } from '../config/allowedOrigins.js'
import { canDriverReceiveDispatch } from '../utils/driverDispatch.js'

export const ROOMS = { police: 'police_channel', govtDriver: 'govt_drivers_channel', privateDriver: 'private_drivers_channel' }
const userRoom = id => `user:${id}`
const emergencyRoom = id => `emergency:${id}`
const sosWindows = new Map()

function cookieValue(cookieHeader, name) {
  const entry = cookieHeader?.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`))
  if (!entry) return null
  try { return decodeURIComponent(entry.slice(name.length + 1)) } catch { return null }
}

async function socketIdentity(socket, next) {
  try {
    const origin = socket.handshake.headers.origin
    if (origin && !allowedOrigins.includes(origin)) return next(new Error('Origin is not allowed'))
    const token = socket.handshake.auth?.token || cookieValue(socket.handshake.headers.cookie, 'token') || cookieValue(socket.handshake.headers.cookie, 'driverToken')
    if (!token) return next()
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] })
    if (payload.role === 'GOVT_DRIVER') {
      const driver = await GovtDriver.findById(payload.sub).select('+sessionVersion').lean()
      if (driver && (payload.ver ?? 0) === (driver.sessionVersion ?? 0)) socket.data.driver = driver
    } else {
      const user = await User.findById(payload.sub).select('+sessionVersion').lean()
      if (user && user.role === payload.role && (payload.ver ?? 0) === (user.sessionVersion ?? 0)) socket.data.user = user
    }
    next()
  } catch { next() }
}

function validLocation(location) {
  const lat = Number(location?.lat); const lng = Number(location?.lng)
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
    ? { lat, lng, heading: Number.isFinite(Number(location?.heading)) ? Number(location.heading) : undefined }
    : null
}

async function persistEmergency(payload, user) {
  const location = validLocation(payload.location || payload)
  if (!location) throw new Error('A valid location with lat and lng is required')
  const incidentDetails = typeof payload.incidentDetails === 'string' ? payload.incidentDetails.trim().slice(0, 1000) : undefined
  if (payload.image && (typeof payload.image !== 'string' || payload.image.length > 1_500_000 || !/^data:image\/(jpeg|png|webp);base64,/i.test(payload.image))) throw new Error('Incident evidence must be a JPEG, PNG, or WebP image under 1.5 MB')
  const incidentImage = payload.image ? await uploadImage(payload.image) : null
  const request = await EmergencyRequest.create({ userId: user?._id, anonymous: !user, location, incidentImage: incidentImage || undefined, incidentDetails })
  await EmergencyAlert.create({ emergencyRequestId: request._id, type: 'NEW_EMERGENCY_ALERT', recipients: [ROOMS.govtDriver, ROOMS.police], deliveredAt: new Date() })
  return request
}

export function registerSocketHandlers(io) {
  io.use(socketIdentity)
  io.on('connection', socket => {
    const user = socket.data.user
    const driver = socket.data.driver
    if (user) socket.join(userRoom(user._id.toString()))
    let driverRoomWatcher
    const sessionWatcher = (user || driver) && setInterval(async () => {
      try {
        const current = user
          ? await User.findById(user._id).select('+sessionVersion').lean()
          : await GovtDriver.findById(driver._id).select('+sessionVersion').lean()
        const original = user || driver
        if (!current || (current.sessionVersion ?? 0) !== (original.sessionVersion ?? 0) || (user && current.role !== user.role)) socket.disconnect(true)
      } catch { socket.disconnect(true) }
    }, 15_000)

    const syncDriverRoom = async () => {
      if (!driver) return
      const currentDriver = await GovtDriver.findById(driver._id).lean().catch(() => null)
      const eligibleDriver = canDriverReceiveDispatch(currentDriver) ? currentDriver : null
      const targetRoom = eligibleDriver?.driverType === 'PRIVATE' ? ROOMS.privateDriver : eligibleDriver ? ROOMS.govtDriver : null
      for (const room of [ROOMS.govtDriver, ROOMS.privateDriver]) {
        if (room === targetRoom) socket.join(room)
        else socket.leave(room)
      }
    }

    socket.on('join_room', async ({ role } = {}) => {
      let room = null
      if (['GOVT_DRIVER', 'PRIVATE_DRIVER'].includes(role) && driver) {
        await syncDriverRoom()
        const expectedRoom = role === 'PRIVATE_DRIVER' ? ROOMS.privateDriver : ROOMS.govtDriver
        if (socket.rooms.has(expectedRoom)) {
          room = expectedRoom
          if (!driverRoomWatcher) driverRoomWatcher = setInterval(syncDriverRoom, 30_000)
        }
      }
      if (role === 'POLICE') room = ROOMS.police
      if (room) socket.join(room)
      socket.emit('room_joined', { room, success: Boolean(room) })
    })

    socket.on('driver_location_update', async ({ emergencyId, lat, lng, heading } = {}) => {
      const currentDriver = driver && await GovtDriver.findById(driver._id).lean()
      const eligibleDriver = currentDriver?.driverType !== 'PRIVATE' && canDriverReceiveDispatch(currentDriver) ? currentDriver : null
      if (!eligibleDriver) return socket.emit('socket_error', { message: 'A verified government driver account is required' })
      const location = validLocation({ lat, lng, heading })
      if (!location || !emergencyId) return socket.emit('socket_error', { message: 'Valid active emergency and driver coordinates are required' })
      const emergency = await EmergencyRequest.findOneAndUpdate({ _id: emergencyId, assignedDriverId: eligibleDriver._id, status: { $in: ['PENDING', 'ACCEPTED', 'ARRIVED'] } }, { $set: { driverLocation: { ...location, updatedAt: new Date() } } }, { returnDocument: 'after' }).lean().catch(() => null)
      if (!emergency) return
      const payload = { driverId: eligibleDriver._id, emergencyId, location }
      if (emergency.userId) io.to(userRoom(emergency.userId.toString())).emit('DRIVER_LOCATION_UPDATED', payload)
      io.to(emergencyRoom(emergencyId)).to(ROOMS.police).emit('DRIVER_LOCATION_UPDATED', payload)
    })

    socket.on('user_location_update', async ({ emergencyId, lat, lng } = {}) => {
      if (!user) return socket.emit('socket_error', { message: 'User authentication required' })
      const location = validLocation({ lat, lng })
      if (!location || !emergencyId) return socket.emit('socket_error', { message: 'Valid emergency location is required' })
      const emergency = await EmergencyRequest.findOneAndUpdate({ _id: emergencyId, userId: user._id, status: { $in: ['PENDING', 'ACCEPTED', 'ARRIVED'] } }, { $set: { location: { ...location, updatedAt: new Date() } } }, { returnDocument: 'after' }).lean().catch(() => null)
      if (!emergency) return
      const payload = { emergencyId: emergency._id, location: emergency.location }
      io.to(ROOMS.police).to(ROOMS.govtDriver).emit('USER_LOCATION_UPDATED', payload)
    })

    const handleSos = async (payload = {}, acknowledgement) => {
      try {
        const now = Date.now()
        const ip = socket.handshake.address || 'unknown'
        let window = sosWindows.get(ip)
        if (!window || window.resetAt <= now) window = { count: 0, resetAt: now + 15 * 60 * 1000 }
        if (++window.count > 5) return acknowledgement?.({ success: false, message: 'Too many emergency requests. Please try again shortly.' })
        sosWindows.set(ip, window)
        if (sosWindows.size > 10000) for (const [key, value] of sosWindows) if (value.resetAt <= now) sosWindows.delete(key)
        const request = await persistEmergency(payload, user)
        socket.join(emergencyRoom(request._id.toString()))
        const caller = user ? { _id: user._id, name: user.name, phone: user.phone } : null
        const alert = { emergencyId: request._id, status: request.status, location: request.location, incidentImage: request.incidentImage, userId: caller }
        io.to(ROOMS.govtDriver).to(ROOMS.police).emit('NEW_EMERGENCY_ALERT', alert)
        if (user) io.to(userRoom(user._id.toString())).emit('EMERGENCY_DISPATCH_RECEIVED', alert)
        socket.emit('emergency:created', { success: true, data: alert })
        acknowledgement?.({ success: true, data: alert })
      } catch (error) { socket.emit('socket_error', { message: error.message }); acknowledgement?.({ success: false, message: error.message }) }
    }
    socket.on('emergency_sos_triggered', handleSos)
    socket.on('emergency:dispatch', handleSos)

    socket.on('driver_accept_emergency', async ({ emergencyId } = {}) => {
      const currentDriver = driver && await GovtDriver.findById(driver._id).lean()
      const eligibleDriver = currentDriver?.driverType !== 'PRIVATE' && canDriverReceiveDispatch(currentDriver) ? currentDriver : null
      if (!eligibleDriver) return socket.emit('socket_error', { message: 'A verified government driver account is required' })
      try {
        const emergency = await EmergencyRequest.findOneAndUpdate({ _id: emergencyId, status: 'PENDING', assignedDriverId: { $exists: false } }, { $set: { status: 'ACCEPTED', assignedDriverId: eligibleDriver._id } }, { returnDocument: 'after' }).lean()
        if (!emergency) return socket.emit('socket_error', { message: 'Emergency is unavailable or already assigned' })
        const assignment = { emergencyId: emergency._id, userId: emergency.userId, status: emergency.status, driver: { id: eligibleDriver._id, name: eligibleDriver.name, phone: eligibleDriver.phone, selfie: eligibleDriver.selfie } }
        io.to(ROOMS.police).emit('DRIVER_ASSIGNED', assignment)
        if (emergency.userId) io.to(userRoom(emergency.userId.toString())).emit('DRIVER_ASSIGNED', assignment)
        io.to(emergencyRoom(emergencyId)).emit('DRIVER_ASSIGNED', assignment)
      } catch { socket.emit('socket_error', { message: 'Unable to accept this emergency' }) }
    })
    socket.on('disconnect', reason => { if (driverRoomWatcher) clearInterval(driverRoomWatcher); if (sessionWatcher) clearInterval(sessionWatcher); console.log(`[socket] ${socket.id} disconnected: ${reason}`) })
  })
}
