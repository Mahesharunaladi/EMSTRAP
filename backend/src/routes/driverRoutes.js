import { Router } from 'express'
import { activeEmergency, acceptDriverEmergency, updateDriverEmergencyStatus, updateDriverDutyStatus, updateDriverFcmToken, currentDriver, loginDriver, logoutDriver, registerDriver, resendDriverVerification, updateDriverLocation, updateDriverProfile, uploadDriverDocuments, verifyDriverEmail } from '../controllers/driverController.js'
import { authenticateDriver, optionalAuthenticateDriver } from '../middlewares/driverAuthMiddleware.js'
import { rateLimit } from '../middlewares/rateLimit.js'
import { acceptDriverBooking, cancelBookingByDriver, getDriverBookings, sendBookingMessage, updateDriverBookingLocation, updateDriverBookingStatus } from '../controllers/bookingController.js'

const router = Router()
router.post('/register', rateLimit({ max: 5 }), registerDriver)
router.post('/verify-email', rateLimit({ max: 6 }), verifyDriverEmail)
router.post('/resend-verification', rateLimit({ max: 3 }), resendDriverVerification)
router.post('/login', rateLimit({ max: 10 }), loginDriver)
router.get('/me', optionalAuthenticateDriver, currentDriver)
router.post('/logout', authenticateDriver, logoutDriver)
router.patch('/profile', authenticateDriver, updateDriverProfile)
router.patch('/location', authenticateDriver, updateDriverLocation)
router.patch('/duty-status', authenticateDriver, updateDriverDutyStatus)
router.patch('/duty', authenticateDriver, updateDriverDutyStatus)
router.patch('/fcm-token', authenticateDriver, updateDriverFcmToken)
router.post('/documents', authenticateDriver, uploadDriverDocuments)
router.get('/active-emergency', authenticateDriver, activeEmergency)
router.post('/emergency/:emergencyId/accept', authenticateDriver, acceptDriverEmergency)
router.patch('/emergency/:emergencyId/status', authenticateDriver, updateDriverEmergencyStatus)
router.get('/bookings', authenticateDriver, getDriverBookings)
router.post('/bookings/:bookingId/accept', authenticateDriver, acceptDriverBooking)
router.patch('/bookings/:bookingId/status', authenticateDriver, updateDriverBookingStatus)
router.patch('/bookings/:bookingId/location', authenticateDriver, updateDriverBookingLocation)
router.patch('/bookings/:bookingId/cancel-by-driver', authenticateDriver, cancelBookingByDriver)
router.post('/bookings/:bookingId/message', authenticateDriver, sendBookingMessage)
export default router
