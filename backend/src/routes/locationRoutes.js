import { Router } from 'express'
import { searchAddress } from '../controllers/locationController.js'
import { authenticate } from '../middlewares/authMiddleware.js'

const router = Router()
router.get('/search', authenticate, searchAddress)
export default router
