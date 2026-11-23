/**
 * Role-Specific Audio Buzzer / Alert Tone Manager
 * - Emergency Siren / Klaxon (File 1): Government Ambulance Drivers & Police
 * - Triple-Chime (File 2): Private Ambulance Drivers
 */

let activeEmergencyAudio = null
let activeBookingAudio = null

export function playEmergencySiren(loop = true) {
  try {
    if (!activeEmergencyAudio) {
      activeEmergencyAudio = new Audio('/sounds/emergency-siren.mp3')
    }
    activeEmergencyAudio.loop = loop
    activeEmergencyAudio.currentTime = 0
    const promise = activeEmergencyAudio.play()
    if (promise !== undefined) {
      promise.catch(err => {
        console.warn('[AudioPlayer] Autoplay prevented or error playing emergency siren:', err.message)
      })
    }
  } catch (e) {
    console.warn('[AudioPlayer] Emergency siren initialization failed:', e.message)
  }
}

export function stopEmergencySiren() {
  if (activeEmergencyAudio) {
    try {
      activeEmergencyAudio.pause()
      activeEmergencyAudio.currentTime = 0
    } catch (_) {}
  }
}

export function playBookingChime() {
  try {
    if (!activeBookingAudio) {
      activeBookingAudio = new Audio('/sounds/booking-chime.mp3')
    }
    activeBookingAudio.loop = false
    activeBookingAudio.currentTime = 0
    const promise = activeBookingAudio.play()
    if (promise !== undefined) {
      promise.catch(err => {
        console.warn('[AudioPlayer] Autoplay prevented for booking chime:', err.message)
      })
    }
  } catch (e) {
    console.warn('[AudioPlayer] Booking chime error:', e.message)
  }
}
