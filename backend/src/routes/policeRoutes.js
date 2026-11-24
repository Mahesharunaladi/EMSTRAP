import { Router } from 'express'
import { getPoliceAlerts, liveTracking, nearestStation } from '../controllers/policeController.js'

const router = Router()

router.get('/live-tracking', liveTracking)
router.get('/alerts', getPoliceAlerts)
router.get('/nearest-station', nearestStation)

export default router
