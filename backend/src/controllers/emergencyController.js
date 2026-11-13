import { EmergencyAlert, EmergencyRequest } from '../config/db.js'
import { uploadImage } from '../config/cloudinary.js'

const ROOMS = { police: 'police_channel', govtDriver: 'govt_drivers_channel' }
const userRoom = id => `user:${id}`

function validLocation(location) {
  const lat = Number(location?.lat)
  const lng = Number(location?.lng)
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
    ? { lat, lng, source: location?.source || 'browser-gps', heading: Number.isFinite(Number(location?.heading)) ? Number(location.heading) : undefined }
    : null
}

export async function dispatchEmergencyHttp(req, res, next) {
  try {
    const user = req.user
    const location = validLocation(req.body.location || req.body)
    if (!location) {
      return res.status(400).json({ success: false, message: 'Valid coordinates (lat, lng) are required for emergency dispatch', data: null })
    }

    const incidentDetails = typeof req.body.incidentDetails === 'string'
      ? req.body.incidentDetails.trim().slice(0, 1000)
      : undefined

    const request = await EmergencyRequest.create({
      userId: user?._id,
      anonymous: !user,
      location,
      incidentDetails,
    })

    await EmergencyAlert.create({
      emergencyRequestId: request._id,
      type: 'NEW_EMERGENCY_ALERT',
      recipients: [ROOMS.govtDriver, ROOMS.police],
      deliveredAt: new Date(),
    })

    const caller = user ? { _id: user._id, name: user.name, phone: user.phone } : null
    const alert = {
      emergencyId: request._id,
      status: request.status,
      location: request.location,
      incidentImage: null,
      userId: caller,
      createdAt: request.createdAt,
    }

    const io = req.app.get('io')
    if (io) {
      io.to(ROOMS.govtDriver).to(ROOMS.police).emit('NEW_EMERGENCY_ALERT', alert)
      if (user) {
        io.to(userRoom(user._id.toString())).emit('EMERGENCY_DISPATCH_RECEIVED', alert)
      }
    }

    if (req.body.image && typeof req.body.image === 'string' && /^data:image\/(jpeg|png|webp);base64,/i.test(req.body.image)) {
      uploadImage(req.body.image)
        .then(async uploaded => {
          if (uploaded?.url) {
            await EmergencyRequest.findByIdAndUpdate(request._id, { $set: { incidentImage: uploaded } })
            if (io) {
              const updatedAlert = { ...alert, incidentImage: uploaded }
              io.to(ROOMS.govtDriver).to(ROOMS.police).emit('EMERGENCY_IMAGE_UPDATED', updatedAlert)
            }
          }
        })
        .catch(err => console.error('[cloudinary non-blocking error]', err.message))
    }

    return res.status(201).json({
      success: true,
      message: 'Emergency dispatch sent. Government responders alerted.',
      data: alert,
    })
  } catch (error) {
    next(error)
  }
}
