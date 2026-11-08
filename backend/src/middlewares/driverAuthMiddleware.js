import jwt from 'jsonwebtoken'
import { GovtDriver } from '../config/db.js'

export async function authenticateDriver(req, res, next) {
  try {
    const token = req.cookies?.driverToken || (req.get('authorization')?.startsWith('Bearer ') ? req.get('authorization').slice(7) : null)
    if (!token) return res.status(401).json({ success: false, message: 'Driver authentication required', data: null })
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] })
    if (payload.role !== 'GOVT_DRIVER') return res.status(401).json({ success: false, message: 'Invalid driver session', data: null })
    const driver = await GovtDriver.findById(payload.sub).lean()
    if (!driver) return res.status(401).json({ success: false, message: 'Driver account not found', data: null })
    req.driver = driver; next()
  } catch { res.status(401).json({ success: false, message: 'Invalid driver session', data: null }) }
}
