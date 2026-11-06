import { Router } from 'express'
import { currentUser, login, logout, register, resendVerification, updateCurrentLocation, verifyEmail } from '../controllers/authController.js'
import { authenticate } from '../middlewares/authMiddleware.js'

const router = Router()
router.post('/register', register)
router.post('/verify-email', verifyEmail)
router.post('/resend-verification', resendVerification)
router.post('/login', login)
router.get('/me', authenticate, currentUser)
router.patch('/location', authenticate, updateCurrentLocation)
router.post('/logout', logout)
export default router
