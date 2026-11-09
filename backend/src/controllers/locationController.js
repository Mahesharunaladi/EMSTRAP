import { User } from '../config/db.js'

function parseCoordinates(lat, lng) {
  const latitude = Number(lat); const longitude = Number(lng)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null
  return { lat: latitude, lng: longitude }
}

export async function updateCurrentLocation(req, res, next) {
  try {
    const coordinates = parseCoordinates(req.body.lat, req.body.lng)
    if (!coordinates) return res.status(400).json({ success: false, message: 'Valid latitude and longitude are required', data: null })
    const location = { ...coordinates, address: req.body.address?.trim() || undefined, source: req.body.source || 'browser-gps', updatedAt: new Date() }
    const user = await User.findByIdAndUpdate(req.user._id, { $set: { currentLocation: location } }, { returnDocument: 'after', runValidators: true }).lean()
    res.json({ success: true, message: 'Location updated', data: { location: user.currentLocation } })
  } catch (error) { next(error) }
}

export async function reverseGeocode(req, res, next) {
  try {
    const coordinates = parseCoordinates(req.query.lat, req.query.lng)
    if (!coordinates) return res.status(400).json({ success: false, message: 'Valid latitude and longitude are required', data: null })
    const url = new URL('https://nominatim.openstreetmap.org/reverse')
    url.search = new URLSearchParams({ format: 'jsonv2', lat: String(coordinates.lat), lon: String(coordinates.lng), zoom: '18', addressdetails: '1' }).toString()
    const response = await fetch(url, { headers: { 'User-Agent': 'EmSTraP/1.0 emergency-medical-app', 'Accept-Language': 'en' }, signal: AbortSignal.timeout(5000) })
    if (!response.ok) return res.status(502).json({ success: false, message: 'Address lookup provider is unavailable', data: null })
    const result = await response.json()
    res.json({ success: true, message: 'Address found', data: { address: result.display_name || '', ...coordinates } })
  } catch (error) { next(error) }
}

export async function searchAddress(req, res, next) {
  try {
    const query = req.query.q?.trim()
    if (!query || query.length < 3 || query.length > 200) return res.status(400).json({ success: false, message: 'Enter 3 to 200 characters to search', data: null })
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=1&q=${encodeURIComponent(query)}`, { headers: { 'User-Agent': 'EmSTraP/1.0 emergency-medical-app', 'Accept-Language': 'en' }, signal: AbortSignal.timeout(5000) })
    if (!response.ok) return res.status(502).json({ success: false, message: 'Address search provider is unavailable', data: null })
    const results = await response.json()
    res.json({ success: true, message: 'Address results', data: results.map(result => ({ displayName: result.display_name, lat: Number(result.lat), lng: Number(result.lon) })) })
  } catch (error) { next(error) }
}
