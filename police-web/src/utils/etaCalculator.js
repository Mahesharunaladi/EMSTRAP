/**
 * Calculates distance (km) and estimated arrival time (minutes)
 * using the Haversine formula and typical emergency/urban speed profiles.
 */
export function calculateEta(pointA, pointB, averageSpeedKmh = 40) {
  if (!pointA || !pointB) return null

  const lat1 = Number(pointA.lat != null ? pointA.lat : (Array.isArray(pointA) ? pointA[1] : pointA.latitude))
  const lng1 = Number(pointA.lng != null ? pointA.lng : (Array.isArray(pointA) ? pointA[0] : pointA.longitude))
  const lat2 = Number(pointB.lat != null ? pointB.lat : (Array.isArray(pointB) ? pointB[1] : pointB.latitude))
  const lng2 = Number(pointB.lng != null ? pointB.lng : (Array.isArray(pointB) ? pointB[0] : pointB.longitude))

  if (!Number.isFinite(lat1) || !Number.isFinite(lng1) || !Number.isFinite(lat2) || !Number.isFinite(lng2)) {
    return null
  }

  // Earth radius in kilometers
  const R = 6371
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLng = (lng2 - lng1) * (Math.PI / 180)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  // Direct distance
  const directDistanceKm = R * c

  // Route factor (roads are rarely direct, typically 1.25x - 1.35x crow-flies)
  const routeDistanceKm = directDistanceKm * 1.3

  // ETA in minutes (minimum 1 minute if distance > 0.05km)
  const hours = routeDistanceKm / averageSpeedKmh
  const minutes = Math.max(1, Math.round(hours * 60))

  return {
    distanceKm: Number(routeDistanceKm.toFixed(1)),
    minutes,
    text: minutes <= 1 ? 'Arriving now' : `Arriving in ${minutes} mins`,
    badgeText: minutes <= 1 ? `Arriving now • ${routeDistanceKm.toFixed(1)} km away` : `Arriving in ${minutes} mins • ${routeDistanceKm.toFixed(1)} km away`
  }
}
