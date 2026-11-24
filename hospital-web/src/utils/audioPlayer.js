let audioInstance = null

export function playEmergencySiren(loop = true) {
  try {
    if (!audioInstance) {
      audioInstance = new Audio('/sounds/emergency-alert.mp3')
      audioInstance.onerror = () => {
        audioInstance = new Audio('/sounds/emergency-siren.mp3')
      }
    }
    audioInstance.loop = loop
    audioInstance.currentTime = 0
    audioInstance.play().catch(e => {
      console.warn('Audio playback waiting for interaction:', e?.message)
    })
  } catch (err) {
    console.warn('Audio initialization notice:', err?.message)
  }
}

export function stopEmergencySiren() {
  try {
    if (audioInstance) {
      audioInstance.pause()
      audioInstance.currentTime = 0
    }
  } catch {}
}
