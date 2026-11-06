import { Router } from 'express'
import { billingHistory, currentUser, login, logout, register, resendVerification, rideHistory, updateCurrentLocation, updateProfile, verifyEmail } from '../controllers/authController.js'
import { authenticate } from '../middlewares/authMiddleware.js'

const router = Router()
router.post('/register', register)
router.post('/verify-email', verifyEmail)
router.post('/resend-verification', resendVerification)
router.post('/login', login)
router.get('/me', authenticate, currentUser)
router.patch('/location', authenticate, updateCurrentLocation)
router.patch('/profile', authenticate, updateProfile)
router.get('/ride-history', authenticate, rideHistory)
router.get('/billing-history', authenticate, billingHistory)
router.post('/logout', logout)
export default router
