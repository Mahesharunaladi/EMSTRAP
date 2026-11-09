import { Router } from 'express'
import { createBooking } from '../controllers/bookingController.js'
import { authenticate } from '../middlewares/authMiddleware.js'
import { rateLimit } from '../middlewares/rateLimit.js'

const router = Router()
router.post('/', authenticate, rateLimit({ windowMs: 15 * 60 * 1000, max: 6 }), createBooking)
export default router
