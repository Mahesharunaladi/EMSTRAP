import { Router } from 'express'
import { activeEmergency, currentDriver, loginDriver, logoutDriver, registerDriver, resendDriverVerification, updateDriverLocation, updateDriverProfile, uploadDriverDocuments, verifyDriverEmail } from '../controllers/driverController.js'
import { authenticateDriver } from '../middlewares/driverAuthMiddleware.js'
import { rateLimit } from '../middlewares/rateLimit.js'

const router = Router()
router.post('/register', rateLimit({ max: 5 }), registerDriver)
router.post('/verify-email', rateLimit({ max: 6 }), verifyDriverEmail)
router.post('/resend-verification', rateLimit({ max: 3 }), resendDriverVerification)
router.post('/login', rateLimit({ max: 10 }), loginDriver)
router.get('/me', authenticateDriver, currentDriver)
router.post('/logout', authenticateDriver, logoutDriver)
router.patch('/profile', authenticateDriver, updateDriverProfile)
router.patch('/location', authenticateDriver, updateDriverLocation)
router.post('/documents', authenticateDriver, uploadDriverDocuments)
router.get('/active-emergency', authenticateDriver, activeEmergency)
export default router
