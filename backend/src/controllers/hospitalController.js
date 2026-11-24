import { EmergencyRequest } from '../config/db.js'
import { ROOMS } from '../socket/socketHandler.js'

export async function getHospitalAlerts(_req, res, next) {
  try {
    const emergencies = await EmergencyRequest.find({
      status: { $in: ['PENDING', 'ACCEPTED', 'ARRIVED', 'ASSIGNED_HOSPITAL', 'RESOLVED', 'COMPLETED'] }
    })
      .populate('assignedDriverId', 'name phone selfie currentLocation vehicleNumber ambulanceType status')
      .populate('userId', 'name phone bloodGroup')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()

    res.json({
      success: true,
      message: 'Active hospital emergency dispatches and alerts',
      data: { emergencies, alerts: emergencies }
    })
  } catch (error) {
    next(error)
  }
}

export async function acknowledgeHospitalAlert(req, res, next) {
  try {
    const { id } = req.params
    const action = req.body.action || 'BED_PREPARED' // 'BED_PREPARED' or 'PATIENT_RECEIVED' or 'COMPLETED'
    const status = action === 'COMPLETED' || action === 'PATIENT_RECEIVED' ? 'COMPLETED' : 'ASSIGNED_HOSPITAL'
    
    const emergency = await EmergencyRequest.findByIdAndUpdate(
      id,
      {
        $set: {
          hospitalStatus: action,
          ...(action === 'COMPLETED' || action === 'PATIENT_RECEIVED' ? { status: 'COMPLETED' } : {})
        }
      },
      { returnDocument: 'after' }
    )
      .populate('assignedDriverId', 'name phone selfie currentLocation vehicleNumber ambulanceType')
      .populate('userId', 'name phone bloodGroup')
      .lean()

    if (!emergency) {
      return res.status(404).json({ success: false, message: 'Emergency dispatch not found', data: null })
    }

    const io = req.app.get('io')
    if (io) {
      const payload = {
        emergencyId: emergency._id,
        hospitalStatus: action,
        status: emergency.status,
        emergency
      }
      io.to('hospital_channel').emit('HOSPITAL_STATUS_UPDATED', payload)
      io.to(ROOMS.police).emit('HOSPITAL_STATUS_UPDATED', payload)
      if (emergency.assignedDriverId?._id) {
        io.to(ROOMS.govtDriver).emit('HOSPITAL_STATUS_UPDATED', payload)
      }
      if (emergency.userId?._id) {
        io.to(`user:${emergency.userId._id}`).emit('HOSPITAL_STATUS_UPDATED', payload)
      }
    }

    res.json({
      success: true,
      message: `Emergency action acknowledged: ${action}`,
      data: { emergency }
    })
  } catch (error) {
    next(error)
  }
}
