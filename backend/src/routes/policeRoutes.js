import { Router } from 'express'
import { liveTracking, nearestStation } from '../controllers/policeController.js'

const router = Router()

router.get('/live-tracking', liveTracking)
router.get('/nearest-station', nearestStation)

export default router
