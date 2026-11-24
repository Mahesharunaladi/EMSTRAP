import React, { useEffect, useRef } from 'react'

export default function HospitalLiveMap({ victimLocation, driverLocation, emergencyId }) {
  const mapContainerRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef([])

  useEffect(() => {
    if (!mapContainerRef.current) return
    const L = window.L
    if (!L) return

    const vLat = victimLocation ? Number(victimLocation.lat) : null
    const vLng = victimLocation ? Number(victimLocation.lng) : null
    const dLat = driverLocation ? Number(driverLocation.lat) : null
    const dLng = driverLocation ? Number(driverLocation.lng) : null

    const defaultLat = dLat || vLat || 12.9716
    const defaultLng = dLng || vLng || 77.5946

    // Initialize map if not created
    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [defaultLat, defaultLng],
        zoom: 13,
        zoomControl: true,
        attributionControl: false
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map)

      mapInstanceRef.current = map
    }

    const map = mapInstanceRef.current

    // Clear old markers
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    const bounds = []

    // Custom Icon for Victim
    if (vLat && vLng && !isNaN(vLat) && !isNaN(vLng)) {
      const victimIcon = L.divIcon({
        className: 'custom-victim-pin',
        html: `
          <div style="background-color: #ef4444; width: 28px; height: 28px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 10px rgba(239,68,68,0.5); display: flex; align-items: center; justify-content: center; color: white;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        popupAnchor: [0, -28]
      })

      const vMarker = L.marker([vLat, vLng], { icon: victimIcon })
        .addTo(map)
        .bindPopup('<b>Patient / Incident Location</b>')
      markersRef.current.push(vMarker)
      bounds.push([vLat, vLng])
    }

    // Custom Icon for Driver Ambulance
    if (dLat && dLng && !isNaN(dLat) && !isNaN(dLng)) {
      const driverIcon = L.divIcon({
        className: 'custom-ambulance-pin',
        html: `
          <div style="background-color: #10b981; width: 32px; height: 32px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 12px rgba(16,185,129,0.5); display: flex; align-items: center; justify-content: center; color: white;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10 17h4V5H2v12h3"/>
              <path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h2"/>
              <circle cx="7.5" cy="17.5" r="2.5"/>
              <circle cx="17.5" cy="17.5" r="2.5"/>
            </svg>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
      })

      const dMarker = L.marker([dLat, dLng], { icon: driverIcon })
        .addTo(map)
        .bindPopup('<b>Ambulance En Route</b>')
      markersRef.current.push(dMarker)
      bounds.push([dLat, dLng])
    }

    // Connect with a dashed line if both are present
    if (vLat && vLng && dLat && dLng) {
      const polyline = L.polyline([[dLat, dLng], [vLat, vLng]], {
        color: '#f43f5e',
        weight: 3,
        dashArray: '6, 8',
        opacity: 0.8
      }).addTo(map)
      markersRef.current.push(polyline)
    }

    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [35, 35], maxZoom: 15 })
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 14)
    }

    setTimeout(() => {
      map.invalidateSize()
    }, 200)

  }, [victimLocation?.lat, victimLocation?.lng, driverLocation?.lat, driverLocation?.lng])

  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  return (
    <div className="relative h-52 w-full rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100">
      <div ref={mapContainerRef} className="h-full w-full" />
      <div className="absolute top-2 right-2 z-[400] flex gap-1.5 pointer-events-none">
        {victimLocation && (
          <span className="flex items-center gap-1 rounded-md bg-white/95 px-2 py-0.5 text-[10px] font-bold text-red-600 shadow border border-slate-200">
            <span className="h-2 w-2 rounded-full bg-red-500" /> Patient Pin
          </span>
        )}
        {driverLocation && (
          <span className="flex items-center gap-1 rounded-md bg-white/95 px-2 py-0.5 text-[10px] font-bold text-emerald-600 shadow border border-slate-200">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Ambulance Pin
          </span>
        )}
      </div>
    </div>
  )
}
