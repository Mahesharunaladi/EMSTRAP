import { Router } from 'express'
import { activeEmergency, currentDriver, loginDriver, logoutDriver, registerDriver, resendDriverVerification, updateDriverLocation, updateDriverProfile, uploadDriverDocuments, verifyDriverEmail } from '../controllers/driverController.js'
import { authenticateDriver } from '../middlewares/driverAuthMiddleware.js'

const router = Router()
router.post('/register', registerDriver)
router.post('/verify-email', verifyDriverEmail)
router.post('/resend-verification', resendDriverVerification)
router.post('/login', loginDriver)
router.get('/me', authenticateDriver, currentDriver)
router.post('/logout', authenticateDriver, logoutDriver)
router.patch('/profile', authenticateDriver, updateDriverProfile)
router.patch('/location', authenticateDriver, updateDriverLocation)
router.post('/documents', authenticateDriver, uploadDriverDocuments)
router.get('/active-emergency', authenticateDriver, activeEmergency)
export default router