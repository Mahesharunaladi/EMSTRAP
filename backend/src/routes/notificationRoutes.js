import { Router } from 'express'
import { registerFcmToken, testPushNotification } from '../controllers/notificationController.js'
import { optionalAuthenticate } from '../middlewares/authMiddleware.js'
import { optionalAuthenticateDriver } from '../middlewares/driverAuthMiddleware.js'

const router = Router()

router.post('/register-token', optionalAuthenticate, optionalAuthenticateDriver, registerFcmToken)
router.post('/test', testPushNotification)

export default router
