/**
 * Native Android & Web Notification Channel & Push Token Manager
 * - Registers versioned high-priority notification channels:
 *   1. emstrap_emergency_buzzer_v4 -> sound: emergency_alert (matches res/raw/emergency_alert.mp3)
 *   2. emstrap_private_booking_buzzer_v4 -> sound: private_driver_alert (matches res/raw/private_driver_alert.mp3)
 * - Persists and syncs FCM push token to backend via POST /api/notifications/register-token
 * - Provides @capacitor/local-notifications foreground/background fallback
 */
import api from '../services/api'
import { playEmergencySiren, playBookingChime } from './audioPlayer'
import toast from 'react-hot-toast'
import { PushNotifications } from '@capacitor/push-notifications'
import { LocalNotifications } from '@capacitor/local-notifications'
import { Capacitor } from '@capacitor/core'

export const EMERGENCY_CHANNEL_ID = 'emstrap_emergency_buzzer_v4'
export const BOOKING_CHANNEL_ID = 'emstrap_private_booking_buzzer_v4'

const PUSH_CHANNELS = [
  {
    id: EMERGENCY_CHANNEL_ID,
    name: 'Emergency SOS Dispatch v4',
    description: 'High-priority emergency alerts with custom siren buzzer',
    importance: 5, // IMPORTANCE_MAX
    sound: 'emergency_alert',
    vibration: true,
    visibility: 1, // VISIBILITY_PUBLIC
    lights: true,
    lightColor: '#ef4444',
  },
  {
    id: BOOKING_CHANNEL_ID,
    name: 'Private Ambulance Booking v4',
    description: 'High-priority ride requests with custom booking alert tone',
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

  // 1. If running under Capacitor or native app container
  if (Capacitor.isPluginAvailable('PushNotifications')) {
    try {
      // Create versioned channels
      for (const channel of PUSH_CHANNELS) {
        await PushNotifications.createChannel(channel)
        console.log(`[PushNotifications] Channel created: ${channel.id} with sound: ${channel.sound}`)
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

        if (channelId === EMERGENCY_CHANNEL_ID || notification.data?.type === 'EMERGENCY_SOS' || notification.data?.type === 'EMERGENCY_ACCEPTED') {
          playEmergencySiren(true)
        } else if (channelId === BOOKING_CHANNEL_ID || notification.data?.type === 'PRIVATE_BOOKING' || notification.data?.type === 'BOOKING_ASSIGNED') {
          playBookingChime()
        }
      })
    } catch (err) {
      console.warn('[PushNotifications] Capacitor channel setup warning:', err.message)
    }
  }

  // 2. Initialize LocalNotifications channels
  if (Capacitor.isPluginAvailable('LocalNotifications')) {
    try {
      for (const channel of PUSH_CHANNELS) {
        await LocalNotifications.createChannel(channel).catch(() => {})
      }
      await LocalNotifications.requestPermissions().catch(() => {})
    } catch (err) {
      console.warn('[LocalNotifications] Setup warning:', err.message)
    }
  }

  // 3. Sync pending FCM token
  const pendingToken = localStorage.getItem('pending_fcm_token') || localStorage.getItem('emstrap_fcm_token')
  if (pendingToken) {
    syncFcmTokenToServer(pendingToken)
  }

  // 4. Browser Desktop Notification API permission request
  if ('Notification' in window && Notification.permission === 'default') {
    try {
      Notification.requestPermission()
    } catch (_) {}
  }
}

/**
 * Trigger immediate high-priority local notification fallback
 */
export async function triggerLocalBuzzerNotification({ title, body, channelId, type }) {
  const targetChannel = channelId || (type === 'PRIVATE_BOOKING' ? BOOKING_CHANNEL_ID : EMERGENCY_CHANNEL_ID)
  const soundName = targetChannel === BOOKING_CHANNEL_ID ? 'private_driver_alert' : 'emergency_alert'

  if (Capacitor.isPluginAvailable('LocalNotifications')) {
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            title: title || 'EmSTraP Alert',
            body: body || 'Emergency dispatch received. Open to respond.',
            id: Math.floor(Date.now() % 100000),
            schedule: { at: new Date(Date.now() + 100) },
            sound: soundName,
            channelId: targetChannel,
            smallIcon: 'ic_launcher',
            actionTypeId: '',
            extra: { type, channelId: targetChannel }
          }
        ]
      })
    } catch (e) {
      console.warn('[LocalNotifications] Schedule fallback notice:', e.message)
    }
  }

  // Also trigger HTML5 audio buzzer
  if (targetChannel === EMERGENCY_CHANNEL_ID || type === 'EMERGENCY_SOS') {
    playEmergencySiren(true)
  } else {
    playBookingChime()
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
    api.patch('/driver/fcm-token', { fcmToken: token }).catch(() => {})
  }
}
