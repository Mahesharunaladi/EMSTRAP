export function normalizeCoords(location) {
  if (!location) return null
  const lat = Number(location.lat ?? location.latitude)
  const lng = Number(location.lng ?? location.longitude)
  if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
    return { lat, lng }
  }
  return null
}

export function calculateDistanceKm(loc1, loc2) {
  const c1 = normalizeCoords(loc1)
  const c2 = normalizeCoords(loc2)
  if (!c1 || !c2) return null
  const R = 6371 // km
  const dLat = (c2.lat - c1.lat) * Math.PI / 180
  const dLng = (c2.lng - c1.lng) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(c1.lat * Math.PI / 180) * Math.cos(c2.lat * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Number((R * c).toFixed(1))
}
