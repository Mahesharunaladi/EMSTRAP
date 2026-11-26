import React, { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export default function PoliceLiveMap({ victimLocation, driverLocation }) {
  const mapContainerRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef([])

  useEffect(() => {
    if (!mapContainerRef.current) return

    const vLat = victimLocation ? Number(victimLocation.lat) : null
    const vLng = victimLocation ? Number(victimLocation.lng) : null
    const dLat = driverLocation ? Number(driverLocation.lat) : null
    const dLng = driverLocation ? Number(driverLocation.lng) : null

    const defaultLat = dLat || vLat || 12.9716
    const defaultLng = dLng || vLng || 77.5946

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [defaultLat, defaultLng],
        zoom: 13,
        zoomControl: true,
        attributionControl: false
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        subdomains: ['a', 'b', 'c']
      }).addTo(map)

      mapInstanceRef.current = map
    }

    const map = mapInstanceRef.current
    map.invalidateSize()
    const timer = setTimeout(() => {
      if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize()
    }, 250)

    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    const bounds = []

    if (vLat && vLng && !isNaN(vLat) && !isNaN(vLng)) {
      const victimIcon = L.divIcon({
        className: 'police-victim-pin',
        html: '<div style="background:#ef4444;width:28px;height:28px;border-radius:50%;border:3px solid #fff;box-shadow:0 3px 10px rgba(239,68,68,.55);display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:bold;">V</div>',
        iconSize: [28, 28],
        iconAnchor: [14, 28]
      })
      markersRef.current.push(L.marker([vLat, vLng], { icon: victimIcon }).addTo(map).bindPopup('<b>Victim / Incident</b>'))
      bounds.push([vLat, vLng])
    }

    if (dLat && dLng && !isNaN(dLat) && !isNaN(dLng)) {
      const driverIcon = L.divIcon({
        className: 'police-driver-pin',
        html: '<div style="background:#10b981;width:30px;height:30px;border-radius:50%;border:3px solid #fff;box-shadow:0 3px 10px rgba(16,185,129,.55);display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;">🚑</div>',
        iconSize: [30, 30],
        iconAnchor: [15, 30]
      })
      markersRef.current.push(L.marker([dLat, dLng], { icon: driverIcon }).addTo(map).bindPopup('<b>Govt Ambulance</b>'))
      bounds.push([dLat, dLng])
    }

    if (vLat && vLng && dLat && dLng) {
      markersRef.current.push(L.polyline([[dLat, dLng], [vLat, vLng]], {
        color: '#ef4444',
        weight: 3,
        dashArray: '6, 8',
        opacity: 0.85
      }).addTo(map))
    }

    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 })
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 14)
    }

    return () => clearTimeout(timer)
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
    <div className="relative h-[240px] w-full rounded-xl overflow-hidden border border-slate-300 bg-slate-100 shadow-inner z-0">
      <div ref={mapContainerRef} className="h-full w-full relative z-0" />
      <div className="absolute top-2 right-2 z-[400] flex gap-1.5 pointer-events-none">
        {victimLocation && (
          <span className="flex items-center gap-1 rounded-md bg-white/95 px-2 py-0.5 text-[10px] font-bold text-red-600 shadow">
            <span className="h-2 w-2 rounded-full bg-red-500" /> Victim
          </span>
        )}
        {driverLocation && (
          <span className="flex items-center gap-1 rounded-md bg-white/95 px-2 py-0.5 text-[10px] font-bold text-emerald-600 shadow">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Ambulance
          </span>
        )}
      </div>
    </div>
  )
}
