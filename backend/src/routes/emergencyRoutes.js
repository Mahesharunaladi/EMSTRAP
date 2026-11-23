import express from 'express'
import {
  addEmergencyEvidence,
  dispatchEmergencyHttp,
  getEmergencyById,
  getMyEmergencies,
  updateEmergencyDescription
} from '../controllers/emergencyController.js'
import { authenticate, optionalAuthenticate } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.post('/dispatch', optionalAuthenticate, dispatchEmergencyHttp)
router.get('/mine', authenticate, getMyEmergencies)
router.get('/:id', optionalAuthenticate, getEmergencyById)
router.patch('/:id/description', optionalAuthenticate, updateEmergencyDescription)
router.patch('/:id/evidence', optionalAuthenticate, addEmergencyEvidence)

export default router
