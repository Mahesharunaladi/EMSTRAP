import { Router } from 'express'
import { reverseGeocode, searchAddress } from '../controllers/locationController.js'
import { authenticate } from '../middlewares/authMiddleware.js'
import { rateLimit } from '../middlewares/rateLimit.js'

const router = Router()
router.get('/search', authenticate, rateLimit({ windowMs: 60 * 1000, max: 20 }), searchAddress)
router.get('/reverse', authenticate, rateLimit({ windowMs: 60 * 1000, max: 5 }), reverseGeocode)
export default router
