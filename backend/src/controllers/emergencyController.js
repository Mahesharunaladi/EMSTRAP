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

    // 30-Minute Duplicate Emergency SOS Cooldown & Timestamp Lock
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000)
    let duplicateQuery = {
      createdAt: { $gte: thirtyMinutesAgo },
      status: { $in: ['PENDING', 'ACCEPTED', 'ARRIVED'] }
    }
    if (user?._id) {
      duplicateQuery.userId = user._id
    } else {
      // Proximity check for anonymous SOS (within ~100m => 0.001 deg)
      duplicateQuery['location.lat'] = { $gte: location.lat - 0.001, $lte: location.lat + 0.001 }
      duplicateQuery['location.lng'] = { $gte: location.lng - 0.001, $lte: location.lng + 0.001 }
    }

    const recentEmergency = await EmergencyRequest.findOne(duplicateQuery).sort({ createdAt: -1 }).lean()
    if (recentEmergency) {
      const elapsedMs = Date.now() - new Date(recentEmergency.createdAt).getTime()
      const remainingSeconds = Math.max(1, Math.ceil((30 * 60 * 1000 - elapsedMs) / 1000))
      return res.status(429).json({
        success: false,
        message: `An active emergency dispatch is already underway. Duplicate alerts are locked for 30 minutes.`,
        data: {
          existingEmergencyId: recentEmergency._id,
          createdAt: recentEmergency.createdAt,
          incidentTimestamp: recentEmergency.createdAt,
          remainingSeconds,
          status: recentEmergency.status,
          driver: recentEmergency.driver || null
        }
      })
    }

    const incidentDetails = typeof req.body.incidentDetails === 'string'
      ? req.body.incidentDetails.trim().slice(0, 1000)
      : undefined

    let incidentImage = null
    if (req.body.image && typeof req.body.image === 'string' && /^data:image\/(jpeg|png|webp);base64,/i.test(req.body.image)) {
      try {
        incidentImage = await uploadImage(req.body.image)
      } catch (_) {}
      // Fallback: If Cloudinary is not configured or fails, store the image directly as data-URI
      if (!incidentImage?.url) {
        incidentImage = { url: req.body.image, publicId: `incident-${Date.now()}` }
      }
    }

    const request = await EmergencyRequest.create({
      userId: user?._id,
      anonymous: !user,
      location,
      incidentImage: incidentImage || undefined,
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
      _id: request._id,
      status: request.status,
      location: request.location,
      incidentImage,
      incidentDetails: request.incidentDetails,
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

    return res.status(201).json({
      success: true,
      message: 'Emergency dispatch sent. Government responders alerted.',
      data: alert,
    })
  } catch (error) {
    next(error)
  }
}

export async function getMyEmergencies(req, res, next) {
  try {
    const userId = req.user?._id
    if (!userId) return res.json({ success: true, message: 'Your emergencies', data: { emergencies: [] } })
    
    const emergencies = await EmergencyRequest.find({ userId }).sort({ createdAt: -1 }).limit(30).lean()
    
    // Populate assigned driver details if assigned
    const driverIds = emergencies.map(e => e.assignedDriverId).filter(Boolean)
    const { GovtDriver } = await import('../config/db.js')
    const drivers = await GovtDriver.find({ _id: { $in: driverIds } }).lean()
    const driverMap = new Map(drivers.map(d => [d._id.toString(), d]))

    const list = emergencies.map(e => {
      const d = e.assignedDriverId ? driverMap.get(e.assignedDriverId.toString()) : null
      return {
        _id: e._id,
        emergencyId: e._id,
        status: e.status,
        location: e.location,
        incidentImage: e.incidentImage,
        incidentDetails: e.incidentDetails,
        createdAt: e.createdAt,
        driver: d ? {
          id: d._id,
          name: d.name,
          phone: d.phone,
          selfie: d.selfie,
          photo: d.selfie?.url || null
        } : null
      }
    })

    res.json({ success: true, message: 'Your emergencies', data: { emergencies: list } })
  } catch (error) {
    next(error)
  }
}
