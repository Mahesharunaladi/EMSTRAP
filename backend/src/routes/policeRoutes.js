import { Router } from 'express'
import { liveTracking, nearestStation } from '../controllers/policeController.js'
import { authenticate, authorizeRoles } from '../middlewares/authMiddleware.js'

const router = Router()
router.use(authenticate, authorizeRoles(['POLICE', 'POLICE_STATION', 'ADMIN']))
router.get('/live-tracking', liveTracking)
router.get('/nearest-station', nearestStation)
export default router
