/**
 * Native Android & Web Notification Channel & Push Token Manager
 * - Registers versioned high-priority notification channels:
 *   1. emstrap_emergency_buzzer_v2 -> sound: emergency_alert (matches res/raw/emergency_alert.mp3)
 *   2. emstrap_private_booking_buzzer_v2 -> sound: private_driver_alert (matches res/raw/private_driver_alert.mp3)
 * - Persists and syncs driver FCM push token to backend via PATCH /api/driver/fcm-token
 */
import api from '../services/api'
import { playEmergencySiren, playBookingChime } from './audioPlayer'

const PUSH_CHANNELS = [
  {
    id: 'emstrap_emergency_buzzer_v2',
    name: 'Emergency SOS Dispatch',
    description: 'High-priority emergency alerts with custom siren klaxon buzzer',
    importance: 5, // IMPORTANCE_MAX
    sound: 'emergency_alert',
    vibration: true,
    visibility: 1, // VISIBILITY_PUBLIC
    lights: true,
    lightColor: '#ef4444',
  },
  {
    id: 'emstrap_private_booking_buzzer_v2',
    name: 'Private Ambulance Booking',
    description: 'High-priority ride requests with custom booking chime',
    importance: 5, // IMPORTANCE_MAX
    sound: 'private_driver_alert',
    vibration: true,
    visibility: 1, // VISIBILITY_PUBLIC
    lights: true,
    lightColor: '#3b82f6',
  },
]

export async function initPushNotificationChannels() {
  if (typeof window === 'undefined') return

  // 1. If running under Capacitor with PushNotifications plugin
  const PushNotifications = window.Capacitor?.Plugins?.PushNotifications
  if (PushNotifications) {
    try {
      for (const channel of PUSH_CHANNELS) {
        await PushNotifications.createChannel(channel)
        console.log(`[PushNotifications] Channel registered: ${channel.id} with sound: ${channel.sound}`)
      }

      // Request permission & register for FCM token
      const permResult = await PushNotifications.requestPermissions()
      if (permResult.receive === 'granted') {
        await PushNotifications.register()
      }

      PushNotifications.addListener('registration', token => {
        if (token?.value) {
          localStorage.setItem('emstrap_fcm_token', token.value)
          syncDriverFcmToken(token.value)
        }
      })

      PushNotifications.addListener('pushNotificationReceived', notification => {
        console.log('[PushNotifications] In-app notification received:', notification)
        const channelId = notification.data?.channelId || notification.channelId
        if (channelId === 'emstrap_emergency_buzzer_v2' || notification.data?.type === 'EMERGENCY_SOS') {
          playEmergencySiren(true)
        } else if (channelId === 'emstrap_private_booking_buzzer_v2' || notification.data?.type === 'PRIVATE_BOOKING') {
          playBookingChime()
        }
      })
    } catch (err) {
      console.warn('[PushNotifications] Capacitor channel setup warning:', err.message)
    }
  }

  // 2. If running inside native Android WebView with JavaScript Interface
  if (window.AndroidBridge?.createNotificationChannels) {
    try {
      window.AndroidBridge.createNotificationChannels(JSON.stringify(PUSH_CHANNELS))
    } catch (_) {}
  }

  // 3. Browser Desktop Notification API permission request
  if ('Notification' in window && Notification.permission === 'default') {
    try {
      Notification.requestPermission()
    } catch (_) {}
  }
}

export async function syncDriverFcmToken(fcmTokenOverride) {
  try {
    const token = fcmTokenOverride || localStorage.getItem('emstrap_fcm_token')
    if (!token) return
    const driverToken = localStorage.getItem('emstrap_driver_token')
    if (!driverToken) return

    await api.patch('/driver/fcm-token', { fcmToken: token })
    console.log('[FCM] Driver token synced with server.')
  } catch (err) {
    console.warn('[FCM] Token sync warning:', err.message)
  }
}
