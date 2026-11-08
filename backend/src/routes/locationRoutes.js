import { Router } from 'express'
import { searchAddress } from '../controllers/locationController.js'
import { authenticate } from '../middlewares/authMiddleware.js'
import { rateLimit } from '../middlewares/rateLimit.js'

const router = Router()
router.get('/search', authenticate, rateLimit({ windowMs: 60 * 1000, max: 20 }), searchAddress)
export default router
