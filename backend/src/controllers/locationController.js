import { User } from '../config/db.js'

function parseCoordinates(lat, lng) {
  const latitude = Number(lat); const longitude = Number(lng)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null
  return { lat: latitude, lng: longitude }
}

export async function resolveAddress(lat, lng) {
  // 1. Try Nominatim (OpenStreetMap) with contact email
  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse')
    url.search = new URLSearchParams({ format: 'jsonv2', lat: String(lat), lon: String(lng), zoom: '18', addressdetails: '1' }).toString()
    const response = await fetch(url, {
      headers: { 'User-Agent': 'EmSTraP/1.0 (emstrapcontacts@gmail.com)', 'Accept-Language': 'en' },
      signal: AbortSignal.timeout(4000)
    })
    if (response.ok) {
      const result = await response.json()
      if (result.display_name) return result.display_name
    }
  } catch (_) {}

  // 2. Fallback to Photon (Komoot OSM mirror)
  try {
    const pUrl = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`
    const pRes = await fetch(pUrl, { headers: { 'User-Agent': 'EmSTraP/1.0' }, signal: AbortSignal.timeout(4000) })
    if (pRes.ok) {
      const pData = await pRes.json()
      const feature = pData.features?.[0]
      if (feature) {
        const props = feature.properties || {}
        const address = [props.name, props.street, props.district, props.city, props.state, props.country].filter(Boolean).join(', ')
        if (address) return address
      }
    }
  } catch (_) {}

  return null
}

export async function updateCurrentLocation(req, res, next) {
  try {
    const coordinates = parseCoordinates(req.body.lat, req.body.lng)
    if (!coordinates) return res.status(400).json({ success: false, message: 'Valid latitude and longitude are required', data: null })
    
    let address = req.body.address?.trim()
    if (!address) {
      const resolved = await resolveAddress(coordinates.lat, coordinates.lng)
      address = resolved || `${coordinates.lat.toFixed(5)}, ${coordinates.lng.toFixed(5)}`
    }

    const location = { ...coordinates, address, source: req.body.source || 'browser-gps', updatedAt: new Date() }
    const user = await User.findByIdAndUpdate(req.user._id, { $set: { currentLocation: location } }, { returnDocument: 'after', runValidators: true }).lean()
    res.json({ success: true, message: 'Location updated', data: { location: user.currentLocation } })
  } catch (error) { next(error) }
}

export async function reverseGeocode(req, res, next) {
  try {
    const coordinates = parseCoordinates(req.query.lat, req.query.lng)
    if (!coordinates) return res.status(400).json({ success: false, message: 'Valid latitude and longitude are required', data: null })
    const address = await resolveAddress(coordinates.lat, coordinates.lng)
    res.json({ success: true, message: 'Address found', data: { address: address || `${coordinates.lat.toFixed(5)}, ${coordinates.lng.toFixed(5)}`, ...coordinates } })
  } catch (error) { next(error) }
}

export async function searchAddress(req, res, next) {
  try {
    const query = req.query.q?.trim()
    if (!query || query.length < 3 || query.length > 200) return res.status(400).json({ success: false, message: 'Enter 3 to 200 characters to search', data: null })

    // 1. Try Nominatim with contact email
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=1&q=${encodeURIComponent(query)}`, {
        headers: { 'User-Agent': 'EmSTraP/1.0 (emstrapcontacts@gmail.com)', 'Accept-Language': 'en' },
        signal: AbortSignal.timeout(4000)
      })
      if (response.ok) {
        const results = await response.json()
        if (Array.isArray(results) && results.length > 0) {
          return res.json({
            success: true,
            message: 'Address results',
            data: results.map(result => ({ displayName: result.display_name, lat: Number(result.lat), lng: Number(result.lon) }))
          })
        }
      }
    } catch (_) {}

    // 2. Fallback to Photon API
    try {
      const pRes = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`, {
        headers: { 'User-Agent': 'EmSTraP/1.0' },
        signal: AbortSignal.timeout(4000)
      })
      if (pRes.ok) {
        const pData = await pRes.json()
        const features = pData.features || []
        if (features.length > 0) {
          const results = features.map(f => {
            const props = f.properties || {}
            const displayName = [props.name, props.street, props.district, props.city, props.state, props.country].filter(Boolean).join(', ')
            return {
              displayName: displayName || props.name || query,
              lat: Number(f.geometry.coordinates[1]),
              lng: Number(f.geometry.coordinates[0])
            }
          })
          return res.json({ success: true, message: 'Address results', data: results })
        }
      }
    } catch (_) {}

    // Graceful response: return empty list rather than 502
    res.json({ success: true, message: 'Address results', data: [] })
  } catch (error) { next(error) }
}
