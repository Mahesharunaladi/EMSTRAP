import { User, GovtDriver, PrivateDriver, BookingUser } from '../config/db.js'
import { sendFcmNotification } from '../services/fcmService.js'

/**
 * Register FCM push token across both databases
 * POST /api/notifications/register-token
 * Body: { fcmToken, token, role, userId, isOnDuty }
 */
export async function registerFcmToken(req, res, next) {
  try {
    const rawToken = req.body.fcmToken || req.body.token
    const fcmToken = typeof rawToken === 'string' ? rawToken.trim() : ''
    const role = String(req.body.role || req.user?.role || req.driver?.role || 'USER').toUpperCase()
    const userId = req.body.userId || req.user?._id || req.driver?._id
    const isOnDuty = req.body.isOnDuty !== false

    if (!fcmToken) {
      return res.status(400).json({ success: false, message: 'FCM push token is required', data: null })
    }

    const updates = []

    // 1. If User or generic userId
    if (userId) {
      updates.push(
        User.findByIdAndUpdate(userId, {
          $set: { fcmToken },
          $addToSet: { fcmTokens: fcmToken }
        }).catch(() => null)
      )
      updates.push(
        GovtDriver.findByIdAndUpdate(userId, {
          $set: { fcmToken, ...(typeof req.body.isOnDuty === 'boolean' ? { isOnDuty } : {}) },
          $addToSet: { fcmTokens: fcmToken }
        }).catch(() => null)
      )
      updates.push(
        PrivateDriver.findByIdAndUpdate(userId, {
          $set: { fcmToken, ...(typeof req.body.isOnDuty === 'boolean' ? { isOnDuty } : {}) },
          $addToSet: { fcmTokens: fcmToken }
        }).catch(() => null)
      )
    }

    // 2. Also register on matching logged-in session user/driver
    if (req.user?._id) {
      updates.push(
        User.findByIdAndUpdate(req.user._id, {
          $set: { fcmToken },
          $addToSet: { fcmTokens: fcmToken }
        }).catch(() => null)
      )
      if (req.user.email) {
        updates.push(
          BookingUser.findOneAndUpdate(
            { email: req.user.email },
            { $set: { fcmToken }, $addToSet: { fcmTokens: fcmToken } }
          ).catch(() => null)
        )
      }
    }

    if (req.driver?._id) {
      updates.push(
        GovtDriver.findByIdAndUpdate(req.driver._id, {
          $set: { fcmToken, ...(typeof req.body.isOnDuty === 'boolean' ? { isOnDuty } : {}) },
          $addToSet: { fcmTokens: fcmToken }
        }).catch(() => null)
      )
      updates.push(
        PrivateDriver.findByIdAndUpdate(req.driver._id, {
          $set: { fcmToken, ...(typeof req.body.isOnDuty === 'boolean' ? { isOnDuty } : {}) },
          $addToSet: { fcmTokens: fcmToken }
        }).catch(() => null)
      )
    }

    await Promise.all(updates)

    return res.json({
      success: true,
      message: 'FCM device token registered successfully for high-priority buzzer dispatch',
      data: { fcmToken, role }
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Diagnostic test endpoint
 * POST /api/notifications/test
 * Body: { fcmToken, role, channelId, sound, title, body }
 */
export async function testPushNotification(req, res, next) {
  try {
    const { fcmToken, role, title, body, channelId, sound } = req.body
    let targetTokens = []

    if (fcmToken) {
      targetTokens = [fcmToken.trim()]
    } else if (role === 'GOVT_DRIVER') {
      const drivers = await GovtDriver.find({ fcmToken: { $exists: true, $ne: '' } }).select('fcmToken').lean()
      targetTokens = drivers.map(d => d.fcmToken).filter(Boolean)
    } else if (role === 'PRIVATE_DRIVER') {
      const pDrivers = await PrivateDriver.find({ fcmToken: { $exists: true, $ne: '' } }).select('fcmToken').lean()
      targetTokens = pDrivers.map(d => d.fcmToken).filter(Boolean)
    } else if (role === 'USER') {
      const users = await User.find({ fcmToken: { $exists: true, $ne: '' } }).select('fcmToken').lean()
      targetTokens = users.map(u => u.fcmToken).filter(Boolean)
    }

    if (!targetTokens.length) {
      return res.status(400).json({
        success: false,
        message: 'No destination FCM tokens found for the requested target',
        data: null
      })
    }

    const testChannel = channelId || (role === 'PRIVATE_DRIVER' ? 'emstrap_private_booking_buzzer_v4' : 'emstrap_emergency_buzzer_v4')
    const testSound = sound || (role === 'PRIVATE_DRIVER' ? 'private_driver_alert' : 'emergency_alert')

    const result = await sendFcmNotification({
      tokens: targetTokens,
      title: title || '🚨 EmSTraP Diagnostic Push Test',
      body: body || 'Test push notification delivery verification.',
      channelId: testChannel,
      sound: testSound,
      data: {
        type: 'DIAGNOSTIC_TEST',
        timestamp: new Date().toISOString()
      }
    })

    return res.json({
      success: true,
      message: 'Push notification test dispatched',
      data: {
        tokensTested: targetTokens.length,
        result
      }
    })
  } catch (error) {
    next(error)
  }
}
