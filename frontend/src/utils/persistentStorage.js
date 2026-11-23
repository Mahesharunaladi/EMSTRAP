/**
 * Dual-Layer Persistent Storage Adapter
 * Safely persists authentication session and user profiles across Android WebView reboots.
 * Layer 1: @capacitor/preferences (Native SharedPreferences - never wiped by Android WebView)
 * Layer 2: localStorage (standard browser persistent storage)
 */

let PreferencesPlugin = null

// Dynamically check if @capacitor/preferences is available
try {
  import('@capacitor/preferences').then(mod => {
    PreferencesPlugin = mod.Preferences
  }).catch(() => {})
} catch (_) {}

export async function setItem(key, value) {
  const strValue = typeof value === 'string' ? value : JSON.stringify(value)
  try {
    localStorage.setItem(key, strValue)
  } catch (_) {}

  if (PreferencesPlugin) {
    try {
      await PreferencesPlugin.set({ key, value: strValue })
    } catch (_) {}
  }
}

export async function getItem(key) {
  if (PreferencesPlugin) {
    try {
      const { value } = await PreferencesPlugin.get({ key })
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

  if (PreferencesPlugin) {
    try {
      await PreferencesPlugin.remove({ key })
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
