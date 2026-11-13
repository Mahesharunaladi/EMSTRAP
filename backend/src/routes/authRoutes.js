import { Router } from 'express'
import { billingHistory, currentUser, login, logout, register, resendVerification, rideHistory, updateCurrentLocation, updateProfile, verifyEmail } from '../controllers/authController.js'
import { authenticate, optionalAuthenticate } from '../middlewares/authMiddleware.js'
import { rateLimit } from '../middlewares/rateLimit.js'

const router = Router()
router.post('/register', rateLimit({ max: 5 }), register)
router.post('/verify-email', rateLimit({ max: 6 }), verifyEmail)
router.post('/resend-verification', rateLimit({ max: 3 }), resendVerification)
router.post('/login', rateLimit({ max: 10 }), login)
router.get('/me', optionalAuthenticate, currentUser)
router.patch('/location', authenticate, updateCurrentLocation)
router.patch('/profile', authenticate, updateProfile)
router.get('/ride-history', authenticate, rideHistory)
router.get('/billing-history', authenticate, billingHistory)
router.post('/logout', authenticate, logout)
export default router
