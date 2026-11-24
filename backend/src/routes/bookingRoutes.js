import { updateDriverDutyStatus } from '../controllers/driverController.js'
import { authenticateDriver } from '../middlewares/driverAuthMiddleware.js'
import { Router } from 'express'
import { createBooking, getMyBookings } from '../controllers/bookingController.js'
import { authenticate } from '../middlewares/authMiddleware.js'
import { rateLimit } from '../middlewares/rateLimit.js'

const router = Router()
router.get('/mine', authenticate, getMyBookings)
router.post('/', authenticate, rateLimit({ windowMs: 15 * 60 * 1000, max: 6 }), createBooking)
router.patch('/driver/duty', authenticateDriver, updateDriverDutyStatus)
router.patch('/driver/duty-status', authenticateDriver, updateDriverDutyStatus)
export default router
