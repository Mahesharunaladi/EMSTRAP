import { EmergencyAlert, EmergencyRequest, GovtDriver } from '../config/db.js'
import { uploadImage } from '../config/cloudinary.js'
import { sendFcmNotification } from '../services/fcmService.js'

const ROOMS = { police: 'police_channel', govtDriver: 'govt_drivers_channel' }
const userRoom = id => `user:${id}`

function validLocation(location) {
  const lat = Number(location?.lat != null ? location.lat : (Array.isArray(location) ? location[1] : location?.latitude))
  const lng = Number(location?.lng != null ? location.lng : (Array.isArray(location) ? location[0] : location?.longitude))
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
    ? { lat, lng, source: location?.source || 'browser-gps', heading: Number.isFinite(Number(location?.heading)) ? Number(location.heading) : undefined }
    : null
}

/**
 * Calculates distance between two coordinates in meters
 */
function distanceMeters(a, b) {
  if (!a || !b) return Infinity
  const R = 6371e3
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const lat1 = a.lat * Math.PI / 180
  const lat2 = b.lat * Math.PI / 180
  const sinDLat = Math.sin(dLat / 2)
  const sinDLng = Math.sin(dLng / 2)
  const x = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

export async function dispatchEmergencyHttp(req, res, next) {
  try {
    const user = req.user
    const location = validLocation(req.body.location || req.body)
    if (!location) {
      return res.status(400).json({ success: false, message: 'Valid coordinates (lat, lng) are required for emergency dispatch', data: null })
    }

    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000)

    // 30-Minute Smart Duplicate SOS Consolidation (150m - 200m radius or same user)
    const activeEmergencies = await EmergencyRequest.find({
      createdAt: { $gte: thirtyMinutesAgo },
      status: { $in: ['PENDING', 'ACCEPTED', 'ARRIVED'] }
    }).sort({ createdAt: -1 })

    let existingEmergency = null
    for (const em of activeEmergencies) {
      if (user?._id && em.userId && em.userId.toString() === user._id.toString()) {
        existingEmergency = em
        break
      }
      const dist = distanceMeters(location, em.location)
      if (dist <= 200) { // within 150m-200m radius
        existingEmergency = em
        break
      }
    }

    // Process optional incident photo
    let incidentImage = null
    if (req.body.image && typeof req.body.image === 'string' && /^data:image\/(jpeg|png|webp);base64,/i.test(req.body.image)) {
      try {
        incidentImage = await uploadImage(req.body.image)
      } catch (_) {}
      if (!incidentImage?.url) {
        incidentImage = { url: req.body.image, publicId: `incident-${Date.now()}` }
      }
    }

    const incidentDetails = typeof req.body.incidentDetails === 'string'
      ? req.body.incidentDetails.trim().slice(0, 1000)
      : undefined

    // If an alert is already active within 30 minutes at this location:
    // Rule:
    // 1. Do NOT create a second alert and do NOT send a new emergency dispatch popup/notification to Driver.
    // 2. Append User B's photo directly into User A's primary emergency document evidenceImages array.
    // 3. Emit silent data-sync socket event (emergency_evidence_updated & EMERGENCY_EVIDENCE_ADDED) to Driver and Police dashboards.
    if (existingEmergency) {
      const updates = {}
      let newEvidenceEntry = null
      if (incidentImage) {
        newEvidenceEntry = {
          url: incidentImage.url,
          publicId: incidentImage.publicId,
          uploadedBy: user?._id || undefined,
          uploadedAt: new Date(),
          note: incidentDetails ? `Witness Note: ${incidentDetails}` : (existingEmergency.userId?.toString() === user?._id?.toString() ? 'Patient Update' : 'Additional Witness Evidence')
        }
        existingEmergency.evidence = existingEmergency.evidence || []
        existingEmergency.evidence.push(newEvidenceEntry)
        existingEmergency.evidenceImages = existingEmergency.evidenceImages || []
        existingEmergency.evidenceImages.push(newEvidenceEntry)
        updates.evidence = existingEmergency.evidence
        updates.evidenceImages = existingEmergency.evidenceImages
      }
      if (incidentDetails && !existingEmergency.incidentDetails) {
        existingEmergency.incidentDetails = incidentDetails
        updates.incidentDetails = incidentDetails
      } else if (incidentDetails && existingEmergency.incidentDetails) {
        existingEmergency.incidentDetails = `${existingEmergency.incidentDetails} | Additional note: ${incidentDetails}`
        updates.incidentDetails = existingEmergency.incidentDetails
      }

      await EmergencyRequest.findByIdAndUpdate(existingEmergency._id, { $set: updates })

      const io = req.app.get('io')
      if (io) {
        const updatePayload = {
          emergencyId: existingEmergency._id,
          _id: existingEmergency._id,
          evidenceImages: existingEmergency.evidenceImages,
          incidentDetails: existingEmergency.incidentDetails,
          newEvidence: newEvidenceEntry || incidentImage,
        }
        // Emit silent data-sync socket events to assigned driver and police command
        io.to(ROOMS.govtDriver).to(ROOMS.police).to('hospital_channel').emit('emergency_evidence_updated', updatePayload)
        io.to(ROOMS.govtDriver).to(ROOMS.police).to('hospital_channel').emit('EMERGENCY_EVIDENCE_ADDED', updatePayload)
        io.to(`emergency:${existingEmergency._id}`).emit('emergency_evidence_updated', updatePayload)
        io.to(`emergency:${existingEmergency._id}`).emit('EMERGENCY_EVIDENCE_ADDED', updatePayload)
        io.emit('police_emergency_alert', {
          ...updatePayload,
          location: existingEmergency.location,
          status: existingEmergency.status,
          silentSync: true,
        })
      }

      const elapsedMs = Date.now() - new Date(existingEmergency.createdAt).getTime()
      const remainingSeconds = Math.max(1, Math.ceil((30 * 60 * 1000 - elapsedMs) / 1000))

      return res.status(200).json({
        success: true,
        merged: true,
        message: 'Alert already active for this location — your photo has been added to the existing emergency report',
        data: {
          emergencyId: existingEmergency._id,
          _id: existingEmergency._id,
          status: existingEmergency.status,
          location: existingEmergency.location,
          incidentImage: existingEmergency.incidentImage,
          evidenceImages: existingEmergency.evidenceImages,
          incidentDetails: existingEmergency.incidentDetails,
          createdAt: existingEmergency.createdAt,
          remainingSeconds,
          driver: existingEmergency.assignedDriverId ? await GovtDriver.findById(existingEmergency.assignedDriverId).select('name phone selfie currentLocation').lean() : null
        }
      })
    }

    // New Emergency Request creation (First User at this location)
    const initialEvidence = incidentImage ? [{
      url: incidentImage.url,
      publicId: incidentImage.publicId,
      uploadedBy: user?._id || undefined,
      uploadedAt: new Date(),
      note: 'Initial Report'
    }] : []

    const request = await EmergencyRequest.create({
      userId: user?._id,
      anonymous: !user,
      location,
      incidentImage: incidentImage || undefined,
      evidence: initialEvidence,
      evidenceImages: initialEvidence,
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
      evidenceImages: initialEvidence,
      incidentDetails: request.incidentDetails,
      userId: caller,
      createdAt: request.createdAt,
    }

    const io = req.app.get('io')
    if (io) {
      io.to(ROOMS.govtDriver).to(ROOMS.police).to('hospital_channel').emit('NEW_EMERGENCY_ALERT', alert)
      io.emit('police_emergency_alert', alert)
      if (user) {
        io.to(userRoom(user._id.toString())).emit('EMERGENCY_DISPATCH_RECEIVED', alert)
      }
    }

    // Trigger High-Priority FCM Push Notification to ON DUTY Government Drivers
    GovtDriver.find({ isOnDuty: true, driverType: 'GOVERNMENT', fcmToken: { $exists: true, $ne: '' } })
      .select('fcmToken')
      .lean()
      .then(drivers => {
        const tokens = drivers.map(d => d.fcmToken).filter(Boolean)
        if (tokens.length > 0) {
          sendFcmNotification({
            tokens,
            title: '🚨 URGENT EMERGENCY SOS',
            body: 'New emergency dispatch nearby. Tap to view & accept.',
            channelId: 'emstrap_emergency_buzzer_v2',
            sound: 'emergency_alert',
            data: {
              emergencyId: String(request._id),
              type: 'EMERGENCY_SOS',
            }
          }).catch(e => console.warn('[FCM Emergency SOS Warning]', e.message))
        }
      })
      .catch(() => {})

    return res.status(201).json({
      success: true,
      message: 'Emergency dispatch sent. Government responders alerted.',
      data: alert,
    })
  } catch (error) {
    next(error)
  }
}

export async function getEmergencyById(req, res, next) {
  try {
    const { id } = req.params
    const emergency = await EmergencyRequest.findById(id).populate('assignedDriverId', 'name phone selfie currentLocation').lean()
    if (!emergency) {
      return res.status(404).json({ success: false, message: 'Emergency incident not found', data: null })
    }

    const d = emergency.assignedDriverId
    const formatted = {
      ...emergency,
      emergencyId: emergency._id,
      driver: d ? {
        id: d._id,
        name: d.name,
        phone: d.phone,
        selfie: d.selfie,
        photo: d.selfie?.url || null,
        currentLocation: d.currentLocation
      } : null
    }

    res.json({ success: true, message: 'Emergency incident details', data: { emergency: formatted } })
  } catch (error) {
    next(error)
  }
}

export async function updateEmergencyDescription(req, res, next) {
  try {
    const { id } = req.params
    const incidentDetails = typeof req.body.incidentDetails === 'string' ? req.body.incidentDetails.trim().slice(0, 1000) : ''
    if (!incidentDetails) {
      return res.status(400).json({ success: false, message: 'Description details are required', data: null })
    }

    const emergency = await EmergencyRequest.findByIdAndUpdate(
      id,
      { $set: { incidentDetails } },
      { returnDocument: 'after' }
    ).lean()

    if (!emergency) {
      return res.status(404).json({ success: false, message: 'Emergency not found', data: null })
    }

    const io = req.app.get('io')
    if (io) {
      const payload = { emergencyId: emergency._id, _id: emergency._id, incidentDetails: emergency.incidentDetails }
      io.to(ROOMS.govtDriver).to(ROOMS.police).to('hospital_channel').emit('EMERGENCY_DESCRIPTION_UPDATED', payload)
      io.to(`emergency:${emergency._id}`).emit('EMERGENCY_DESCRIPTION_UPDATED', payload)
    }

    res.json({ success: true, message: 'Incident description updated', data: { incidentDetails: emergency.incidentDetails } })
  } catch (error) {
    next(error)
  }
}

export async function addEmergencyEvidence(req, res, next) {
  try {
    const { id } = req.params
    if (!req.body.image || typeof req.body.image !== 'string') {
      return res.status(400).json({ success: false, message: 'Image data is required', data: null })
    }

    let uploaded = null
    try {
      uploaded = await uploadImage(req.body.image)
    } catch (_) {}
    if (!uploaded?.url) {
      uploaded = { url: req.body.image, publicId: `evidence-${Date.now()}` }
    }

    const emergency = await EmergencyRequest.findById(id)
    if (!emergency) {
      return res.status(404).json({ success: false, message: 'Emergency not found', data: null })
    }

    const entry = {
      url: uploaded.url,
      publicId: uploaded.publicId,
      uploadedBy: req.user?._id || undefined,
      uploadedAt: new Date(),
      note: req.body.note || 'Additional Witness Evidence'
    }

    emergency.evidence = emergency.evidence || []
    emergency.evidence.push(entry)
    emergency.evidenceImages = emergency.evidenceImages || []
    emergency.evidenceImages.push(entry)
    await emergency.save()

    const io = req.app.get('io')
    if (io) {
      const payload = {
        emergencyId: emergency._id,
        _id: emergency._id,
        newEvidence: entry,
        evidenceImages: emergency.evidenceImages
      }
      io.to(ROOMS.govtDriver).to(ROOMS.police).to('hospital_channel').emit('emergency_evidence_updated', payload)
      io.to(ROOMS.govtDriver).to(ROOMS.police).to('hospital_channel').emit('EMERGENCY_EVIDENCE_ADDED', payload)
      io.to(`emergency:${emergency._id}`).emit('emergency_evidence_updated', payload)
      io.to(`emergency:${emergency._id}`).emit('EMERGENCY_EVIDENCE_ADDED', payload)
    }

    res.json({ success: true, message: 'Evidence photo added', data: { evidenceImages: emergency.evidenceImages } })
  } catch (error) {
    next(error)
  }
}

export async function getMyEmergencies(req, res, next) {
  try {
    const userId = req.user?._id
    if (!userId) return res.json({ success: true, message: 'Your emergencies', data: { emergencies: [] } })
    
    const emergencies = await EmergencyRequest.find({ userId }).sort({ createdAt: -1 }).limit(30).lean()
    
    const driverIds = emergencies.map(e => e.assignedDriverId).filter(Boolean)
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
        evidenceImages: e.evidenceImages || e.evidence || [],
        incidentDetails: e.incidentDetails,
        createdAt: e.createdAt,
        driverLocation: e.driverLocation || d?.currentLocation || null,
        driver: d ? {
          id: d._id,
          name: d.name,
          phone: d.phone,
          selfie: d.selfie,
          photo: d.selfie?.url || null,
          currentLocation: d.currentLocation
        } : null
      }
    })

    res.json({ success: true, message: 'Your emergencies', data: { emergencies: list } })
  } catch (error) {
    next(error)
  }
}
