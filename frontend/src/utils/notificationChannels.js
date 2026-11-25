/**
 * Native Android & Web Notification Channel & Push Token Manager
 * - Registers versioned high-priority notification channels:
 *   1. emstrap_emergency_buzzer_v3 -> sound: emergency_alert (matches res/raw/emergency_alert.mp3)
 *   2. emstrap_private_booking_buzzer_v3 -> sound: private_driver_alert (matches res/raw/private_driver_alert.mp3)
 * - Persists and syncs FCM push token to backend via POST /api/notifications/register-token
 */
import api from '../services/api'
import { playEmergencySiren, playBookingChime } from './audioPlayer'
import toast from 'react-hot-toast'

const PUSH_CHANNELS = [
  {
    id: 'emstrap_emergency_buzzer_v3',
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
    id: 'emstrap_private_booking_buzzer_v3',
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

      // Check and request runtime notification permissions
      let permResult = await PushNotifications.checkPermissions().catch(() => null)
      if (permResult?.receive !== 'granted') {
        permResult = await PushNotifications.requestPermissions().catch(() => null)
      }

      if (permResult?.receive === 'granted') {
        await PushNotifications.register().catch(e => console.warn('[PushNotifications] Register error:', e.message))
      }

      PushNotifications.addListener('registration', async token => {
        if (token?.value) {
          console.log('[PushNotifications] Device FCM token obtained:', token.value)
          localStorage.setItem('emstrap_fcm_token', token.value)
          localStorage.setItem('pending_fcm_token', token.value)
          await syncFcmTokenToServer(token.value)
        }
      })

      PushNotifications.addListener('registrationError', err => {
        console.warn('[PushNotifications] Registration error:', err)
      })

      PushNotifications.addListener('pushNotificationReceived', notification => {
        console.log('[PushNotifications] In-app notification received:', notification)
        const channelId = notification.data?.channelId || notification.channelId
        const title = notification.title || notification.data?.title || 'EmSTraP Alert'
        const body = notification.body || notification.data?.body || 'New ambulance update received.'

        toast(`${title}: ${body}`, { icon: '🚨', duration: 7000 })

        if (channelId === 'emstrap_emergency_buzzer_v3' || notification.data?.type === 'EMERGENCY_SOS' || notification.data?.type === 'EMERGENCY_ACCEPTED') {
          playEmergencySiren(true)
        } else if (channelId === 'emstrap_private_booking_buzzer_v3' || notification.data?.type === 'PRIVATE_BOOKING' || notification.data?.type === 'BOOKING_ASSIGNED') {
          playBookingChime()
        }
      })
    } catch (err) {
      console.warn('[PushNotifications] Capacitor channel setup warning:', err.message)
    }
  }

  // 2. Sync any pending FCM token
  const pendingToken = localStorage.getItem('pending_fcm_token') || localStorage.getItem('emstrap_fcm_token')
  if (pendingToken) {
    syncFcmTokenToServer(pendingToken)
  }

  // 3. Browser Desktop Notification API permission request
  if ('Notification' in window && Notification.permission === 'default') {
    try {
      Notification.requestPermission()
    } catch (_) {}
  }
}

export async function syncFcmTokenToServer(fcmTokenOverride) {
  try {
    const token = fcmTokenOverride || localStorage.getItem('pending_fcm_token') || localStorage.getItem('emstrap_fcm_token')
    if (!token) return

    let userObj = null
    try {
      const stored = localStorage.getItem('emstrap_user_data')
      if (stored) userObj = JSON.parse(stored)
    } catch (_) {}

    const role = localStorage.getItem('emstrap_role') || (localStorage.getItem('lastRole') === 'DRIVER' ? 'GOVT_DRIVER' : 'USER')
    const isOnDuty = localStorage.getItem('emstrap_driver_onduty') !== 'false'

    await api.post('/notifications/register-token', {
      fcmToken: token,
      token,
      role,
      userId: userObj?._id || userObj?.id,
      isOnDuty
    })

    localStorage.removeItem('pending_fcm_token')
    console.log('[FCM] Token registered with server for role:', role)
  } catch (err) {
    console.warn('[FCM] Token sync warning:', err.message)
  }
}

export async function syncDriverFcmToken(fcmTokenOverride) {
  const token = fcmTokenOverride || localStorage.getItem('emstrap_fcm_token')
  if (token) {
    localStorage.setItem('emstrap_fcm_token', token)
    await syncFcmTokenToServer(token)
    // Also update driver-specific route
    api.patch('/driver/fcm-token', { fcmToken: token }).catch(() => {})
  }
}
