import { EmergencyAlert, EmergencyRequest } from '../config/db.js'
import { uploadImage } from '../config/cloudinary.js'

export const ROOMS = { police: 'police_channel', govtDriver: 'govt_drivers_channel' }

const roomForRole = role => ({ POLICE: ROOMS.police, GOVT_DRIVER: ROOMS.govtDriver, POLICE_STATION: ROOMS.police }[role])
const userRoom = userId => userId ? `user:${userId}` : null

function validLocation(location) {
  const lat = Number(location?.lat); const lng = Number(location?.lng)
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 ? { lat, lng, heading: Number.isFinite(Number(location?.heading)) ? Number(location.heading) : undefined } : null
}

async function persistEmergency(payload) {
  const location = validLocation(payload.location || payload)
  if (!location) throw new Error('A valid location with lat and lng is required')
  const incidentImage = payload.image ? await uploadImage(payload.image) : null
  const request = await EmergencyRequest.create({ userId: payload.userId || undefined, anonymous: !payload.userId, location, incidentImage: incidentImage || (payload.image ? { url: payload.image } : undefined), incidentDetails: payload.incidentDetails })
  await EmergencyAlert.create({ emergencyRequestId: request._id, type: 'NEW_EMERGENCY_ALERT', recipients: [ROOMS.govtDriver, ROOMS.police], deliveredAt: new Date() })
  return request
}

export function registerSocketHandlers(io) {
  io.on('connection', socket => {
    socket.on('join_room', ({ role, userId, room } = {}) => {
      const targetRoom = room || roomForRole(role)
      if (targetRoom) socket.join(targetRoom)
      if (userId) { socket.data.userId = userId; socket.join(userRoom(userId)) }
      socket.data.role = role
      socket.emit('room_joined', { room: targetRoom, success: Boolean(targetRoom) })
    })

    socket.on('driver_location_update', async ({ driverId, emergencyId, lat, lng, heading } = {}) => {
      const location = validLocation({ lat, lng, heading })
      if (!location) return socket.emit('socket_error', { message: 'Invalid driver coordinates' })
      const payload = { driverId, emergencyId, location }
      if (emergencyId) {
        const emergency = await EmergencyRequest.findByIdAndUpdate(emergencyId, { $set: { 'driverLocation.lat': location.lat, 'driverLocation.lng': location.lng, 'driverLocation.heading': location.heading, 'driverLocation.updatedAt': new Date() } }, { returnDocument: 'after' }).catch(() => null)
        if (emergency?.userId) io.to(userRoom(emergency.userId.toString())).emit('DRIVER_LOCATION_UPDATED', payload)
      }
      io.to(ROOMS.police).emit('DRIVER_LOCATION_UPDATED', payload)
    })

    const handleSos = async (payload = {}, acknowledgement) => {
      try {
        const request = await persistEmergency({ ...payload, userId: payload.userId || socket.data.userId })
        const alert = { emergencyId: request._id, status: request.status, location: request.location, incidentImage: request.incidentImage }
        io.to(ROOMS.govtDriver).to(ROOMS.police).emit('NEW_EMERGENCY_ALERT', alert)
        if (request.userId) io.to(userRoom(request.userId.toString())).emit('EMERGENCY_DISPATCH_RECEIVED', alert)
        socket.emit('emergency:created', { success: true, data: alert })
        acknowledgement?.({ success: true, data: alert })
      } catch (error) { socket.emit('socket_error', { message: error.message }); acknowledgement?.({ success: false, message: error.message }) }
    }

    socket.on('emergency_sos_triggered', handleSos)
    socket.on('emergency:dispatch', handleSos)
    socket.on('disconnect', reason => { socket.data = {}; console.log(`[socket] ${socket.id} disconnected: ${reason}`) })
  })
}
