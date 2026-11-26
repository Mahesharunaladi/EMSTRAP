import React, { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix standard Leaflet default icon paths in bundler environments
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

export default function BookingMapPicker({
  pickupCoords,
  destinationCoords,
  onPickLocation,
  activeMode, // 'pickup' | 'destination'
  onChangeMode
}) {
  const mapContainerRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef([])
  const activeModeRef = useRef(activeMode)

  useEffect(() => {
    activeModeRef.current = activeMode
  }, [activeMode])

  useEffect(() => {
    if (!mapContainerRef.current) return

    const pLat = pickupCoords ? Number(pickupCoords.lat) : null
    const pLng = pickupCoords ? Number(pickupCoords.lng) : null
    const dLat = destinationCoords ? Number(destinationCoords.lat) : null
    const dLng = destinationCoords ? Number(destinationCoords.lng) : null

    const defaultLat = pLat || dLat || 12.9716
    const defaultLng = pLng || dLng || 77.5946

    // Initialize Map if not yet created
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

      // Map click handler
      map.on('click', (e) => {
        const { lat, lng } = e.latlng
        if (typeof onPickLocation === 'function') {
          onPickLocation({ lat, lng }, activeModeRef.current)
        }
      })
    }

    const map = mapInstanceRef.current

    // Invalidate size immediately and after delay so WebView containers render cleanly
    map.invalidateSize()
    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize()
      }
    }, 250)

    // Clear previous markers & polylines
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    const bounds = []

    // 1. Pickup Marker (Emerald green)
    if (pLat && pLng && !isNaN(pLat) && !isNaN(pLng)) {
      const pickupIcon = L.divIcon({
        className: 'custom-pickup-pin',
        html: `
          <div style="background-color: #10b981; width: 32px; height: 32px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 12px rgba(16,185,129,0.6); display: flex; align-items: center; justify-content: center; color: white;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
      })

      const pMarker = L.marker([pLat, pLng], { icon: pickupIcon, draggable: true })
        .addTo(map)
        .bindPopup('<b>Pickup Location</b>')

      pMarker.on('dragend', (ev) => {
        const { lat, lng } = ev.target.getLatLng()
        if (typeof onPickLocation === 'function') {
          onPickLocation({ lat, lng }, 'pickup')
        }
      })

      markersRef.current.push(pMarker)
      bounds.push([pLat, pLng])
    }

    // 2. Drop-off Marker (Red)
    if (dLat && dLng && !isNaN(dLat) && !isNaN(dLng)) {
      const dropIcon = L.divIcon({
        className: 'custom-destination-pin',
        html: `
          <div style="background-color: #ef4444; width: 32px; height: 32px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 12px rgba(239,68,68,0.6); display: flex; align-items: center; justify-content: center; color: white;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="3 11 22 2 13 21 11 13 3 11"/>
            </svg>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
      })

      const dMarker = L.marker([dLat, dLng], { icon: dropIcon, draggable: true })
        .addTo(map)
        .bindPopup('<b>Drop-off Destination</b>')

      dMarker.on('dragend', (ev) => {
        const { lat, lng } = ev.target.getLatLng()
        if (typeof onPickLocation === 'function') {
          onPickLocation({ lat, lng }, 'destination')
        }
      })

      markersRef.current.push(dMarker)
      bounds.push([dLat, dLng])
    }

    // 3. Connect line if both exist
    if (pLat && pLng && dLat && dLng) {
      const polyline = L.polyline([[pLat, pLng], [dLat, dLng]], {
        color: '#2563eb',
        weight: 3.5,
        dashArray: '6, 8',
        opacity: 0.85
      }).addTo(map)
      markersRef.current.push(polyline)
    }

    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [35, 35], maxZoom: 15 })
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 14)
    }

    return () => clearTimeout(timer)
  }, [pickupCoords?.lat, pickupCoords?.lng, destinationCoords?.lat, destinationCoords?.lng])

  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  return (
    <div className="relative mt-2 h-[240px] w-full rounded-2xl overflow-hidden border border-slate-300 shadow-inner bg-slate-100 z-0">
      <div ref={mapContainerRef} className="h-full w-full relative z-0" />

      {/* Mode Switcher Overlay */}
      <div className="absolute top-2.5 left-2.5 z-[400] flex gap-1.5 rounded-xl bg-white/95 p-1 shadow-md border border-slate-200 backdrop-blur-sm">
        <button
          type="button"
          onClick={() => onChangeMode('pickup')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition ${
            activeMode === 'pickup'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-emerald-300" />
          Pin Pickup
        </button>
        <button
          type="button"
          onClick={() => onChangeMode('destination')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition ${
            activeMode === 'destination'
              ? 'bg-red-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-red-300" />
          Pin Drop-off
        </button>
      </div>

      <div className="absolute bottom-2 left-2 right-2 z-[400] pointer-events-none">
        <p className="rounded-lg bg-slate-900/80 px-2.5 py-1 text-center text-[10px] font-medium text-white shadow backdrop-blur-xs">
          Tap anywhere or drag pins to select {activeMode === 'pickup' ? 'Pickup' : 'Drop-off'}
        </p>
      </div>
    </div>
  )
}
