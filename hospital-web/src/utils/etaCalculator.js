import { calculateDistanceKm } from './geoUtils'

export function calculateEta(driverLocation, destinationLocation, avgSpeedKmh = 45) {
  const distKm = calculateDistanceKm(driverLocation, destinationLocation)
  if (distKm === null) return null
  const hours = distKm / avgSpeedKmh
  const minutes = Math.max(1, Math.round(hours * 60))
  return {
    distanceKm: distKm,
    minutes,
    text: minutes <= 1 ? 'Arriving now' : `${minutes} min (${distKm} km)`,
    badgeText: minutes <= 1 ? 'ARRIVING NOW' : `${minutes} MIN`,
  }
}
