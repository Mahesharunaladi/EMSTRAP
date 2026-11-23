/**
 * Safe coordinate extractor and validator.
 * Handles:
 * - { lat, lng } / { latitude, longitude }
 * - GeoJSON Array [lng, lat]
 * - GeoJSON Point object { type: 'Point', coordinates: [lng, lat] }
 * Returns { lat: number, lng: number } or null if invalid/non-finite.
 */
export function normalizeCoords(loc) {
  if (!loc) return null

  // 1. Array format [lng, lat]
  if (Array.isArray(loc) && loc.length >= 2) {
    const lng = Number(loc[0])
    const lat = Number(loc[1])
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng }
    }
    return null
  }

  // 2. GeoJSON object { coordinates: [lng, lat] }
  if (Array.isArray(loc.coordinates) && loc.coordinates.length >= 2) {
    const lng = Number(loc.coordinates[0])
    const lat = Number(loc.coordinates[1])
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng }
    }
    return null
  }

  // 3. Object with lat/lng or latitude/longitude
  const rawLat = loc.lat != null ? loc.lat : loc.latitude
  const rawLng = loc.lng != null ? loc.lng : loc.longitude

  if (rawLat != null && rawLng != null) {
    const lat = Number(rawLat)
    const lng = Number(rawLng)
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng }
    }
  }

  return null
}

export function isValidCoords(loc) {
  return normalizeCoords(loc) !== null
}
