import { updateDriverDutyStatus } from '../controllers/driverController.js'
import { authenticateDriver, optionalAuthenticateDriver } from '../middlewares/driverAuthMiddleware.js'
import { Router } from 'express'
import { cancelBookingByDriver, createBooking, getBookingById, getMyBookings, sendBookingMessage } from '../controllers/bookingController.js'
import { authenticate, optionalAuthenticate } from '../middlewares/authMiddleware.js'
import { rateLimit } from '../middlewares/rateLimit.js'

const router = Router()

function authenticateUserOrDriver(req, res, next) {
  optionalAuthenticate(req, res, () => {
    if (req.user) return next()
    optionalAuthenticateDriver(req, res, () => {
      if (req.driver) return next()
      return res.status(401).json({ success: false, message: 'Authentication required', data: null })
    })
  })
}

router.get('/mine', authenticate, getMyBookings)
router.get('/user/my-bookings', authenticate, getMyBookings)
router.post('/', authenticate, rateLimit({ windowMs: 15 * 60 * 1000, max: 6 }), createBooking)
router.post('/create', authenticate, rateLimit({ windowMs: 15 * 60 * 1000, max: 6 }), createBooking)
router.get('/:bookingId', authenticateUserOrDriver, getBookingById)
router.post('/:bookingId/message', authenticateUserOrDriver, sendBookingMessage)
router.patch('/:bookingId/cancel-by-driver', authenticateDriver, cancelBookingByDriver)
router.patch('/driver/duty', authenticateDriver, updateDriverDutyStatus)
router.patch('/driver/duty-status', authenticateDriver, updateDriverDutyStatus)
export default router
