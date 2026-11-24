import { Router } from 'express'
import { acknowledgeHospitalAlert, getHospitalAlerts } from '../controllers/hospitalController.js'

const router = Router()

router.get('/alerts', getHospitalAlerts)
router.get('/live-tracking', getHospitalAlerts)
router.patch('/alerts/:id/acknowledge', acknowledgeHospitalAlert)

export default router
