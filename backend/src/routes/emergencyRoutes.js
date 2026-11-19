import express from 'express'
import { dispatchEmergencyHttp, getMyEmergencies } from '../controllers/emergencyController.js'
import { authenticate, optionalAuthenticate } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.post('/dispatch', optionalAuthenticate, dispatchEmergencyHttp)
router.get('/mine', authenticate, getMyEmergencies)

export default router
