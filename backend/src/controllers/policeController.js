import { EmergencyRequest, Police } from '../config/db.js'

const distance = (a, b) => { const lat = (Number(a.lat) - Number(b.lat)) * 111; const lng = (Number(a.lng) - Number(b.lng)) * 111 * Math.cos(Number(a.lat) * Math.PI / 180); return Math.sqrt((lat * lat) + (lng * lng)) }

export async function liveTracking(_req, res, next) {
  try {
    const emergencies = await EmergencyRequest.find({ status: { $in: ['PENDING', 'ACCEPTED', 'ARRIVED'] } }).populate('assignedDriverId', 'name phone selfie currentLocation status').populate('userId', 'name phone').sort({ createdAt: -1 }).lean()
    res.json({ success: true, message: 'Live police tracking', data: { emergencies } })
  } catch (error) { next(error) }
}

export async function nearestStation(req, res, next) {
  try {
    const lat = Number(req.query.lat); const lng = Number(req.query.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return res.status(400).json({ success: false, message: 'Valid coordinates are required', data: null })
    const stations = await Police.find({ location: { $exists: true } }).lean()
    const station = stations.map(item => ({ ...item, distanceKm: distance({ lat, lng }, item.location) })).sort((a, b) => a.distanceKm - b.distanceKm)[0] || null
    res.json({ success: true, message: 'Nearest police station', data: { station } })
  } catch (error) { next(error) }
}
