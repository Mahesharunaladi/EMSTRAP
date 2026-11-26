import admin from 'firebase-admin'

let initialized = false

export function initFirebase() {
  if (initialized) return admin
  try {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT
    if (serviceAccountJson) {
      const credentials = typeof serviceAccountJson === 'string'
        ? JSON.parse(serviceAccountJson)
        : serviceAccountJson
      admin.initializeApp({
        credential: admin.credential.cert(credentials),
      })
      initialized = true
      console.log('[FCM] Firebase Admin SDK initialized successfully from service account.')
    } else {
      console.warn('[FCM] No FIREBASE_SERVICE_ACCOUNT found in environment. Push notifications simulated.')
    }
  } catch (err) {
    console.warn('[FCM] Firebase initialization warning:', err.message)
  }
  return admin
}

/**
 * Send High-Priority FCM Push Notification with Custom Sound Channels
 * Channel 1: emstrap_emergency_buzzer_v4 (emergency_alert)
 * Channel 2: emstrap_private_booking_buzzer_v4 (private_driver_alert)
 */
export async function sendFcmNotification({ tokens = [], title, body, channelId, sound, data = {} }) {
  const validTokens = (tokens || []).filter(t => typeof t === 'string' && t.trim().length > 10)
  if (!validTokens.length) {
    return { success: false, reason: 'No valid FCM tokens provided' }
  }

  initFirebase()
  if (!admin.apps.length) {
    console.log(`[FCM Mock Broadcast] To ${validTokens.length} devices:`, { title, body, channelId, sound, data })
    return { success: true, mocked: true, count: validTokens.length }
  }

  const message = {
    notification: {
      title,
      body,
    },
    android: {
      priority: 'high',
      notification: {
        channelId,
        sound,
        priority: 'max',
        defaultVibrateTimings: true,
        visibility: 'public',
      },
    },
    data: Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)])
    ),
    tokens: validTokens,
  }

  try {
    const response = await admin.messaging().sendEachForMulticast(message)
    console.log(`[FCM Push Result] Success: ${response.successCount}, Failures: ${response.failureCount}`)
    return { success: true, response }
  } catch (error) {
    console.error('[FCM Push Error]', error.message)
    return { success: false, error: error.message }
  }
}
