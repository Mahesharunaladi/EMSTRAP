import express from 'express'
import { dispatchEmergencyHttp } from '../controllers/emergencyController.js'
import { optionalAuthenticate } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.post('/dispatch', optionalAuthenticate, dispatchEmergencyHttp)

export default router
