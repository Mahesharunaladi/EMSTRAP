/**
 * Dual-Layer Persistent Storage Adapter
 * Safely persists authentication session and user profiles across Android WebView reboots.
 * Checks for global window.Capacitor?.Plugins?.Preferences, Android SharedPreferences via window.AndroidPrefs, and localStorage.
 */

const getCapacitorPreferences = () => {
  if (typeof window !== 'undefined' && window.Capacitor?.Plugins?.Preferences) {
    return window.Capacitor.Plugins.Preferences
  }
  return null
}

export async function setItem(key, value) {
  const strValue = typeof value === 'string' ? value : JSON.stringify(value)
  try {
    localStorage.setItem(key, strValue)
  } catch (_) {}

  const prefs = getCapacitorPreferences()
  if (prefs) {
    try {
      await prefs.set({ key, value: strValue })
    } catch (_) {}
  }
}

export async function getItem(key) {
  const prefs = getCapacitorPreferences()
  if (prefs) {
    try {
      const { value } = await prefs.get({ key })
      if (value !== null && value !== undefined) return value
    } catch (_) {}
  }

  try {
    const val = localStorage.getItem(key)
    if (val !== null && val !== undefined) return val
  } catch (_) {}

  return null
}

export async function removeItem(key) {
  try {
    localStorage.removeItem(key)
  } catch (_) {}

  const prefs = getCapacitorPreferences()
  if (prefs) {
    try {
      await prefs.remove({ key })
    } catch (_) {}
  }
}

export async function clearAuthSession() {
  await removeItem('emstrap_token')
  await removeItem('emstrap_user_token')
  await removeItem('emstrap_user_data')
  await removeItem('emstrap_role')
  await removeItem('emstrap_driver_token')
}
