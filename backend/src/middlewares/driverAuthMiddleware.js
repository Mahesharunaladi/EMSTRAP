import jwt from 'jsonwebtoken'
import { GovtDriver, PrivateDriver } from '../config/db.js'

export async function authenticateDriver(req, res, next) {
  try {
    const token = req.cookies?.driverToken || (req.get('authorization')?.startsWith('Bearer ') ? req.get('authorization').slice(7) : null)
    if (!token) return res.status(401).json({ success: false, message: 'Driver authentication required', data: null })
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] })
    
    // Check GovtDriver first (matches both GOVERNMENT and PRIVATE driverType registered via driver portal)
    let driver = await GovtDriver.findById(payload.sub).select('+sessionVersion').lean()
    
    // Fallback: check PrivateDriver collection if not found in GovtDriver
    if (!driver) {
      driver = await PrivateDriver.findById(payload.sub).select('+sessionVersion').lean()
      if (driver && !driver.driverType) driver.driverType = 'PRIVATE'
    }
    
    if (!driver) return res.status(401).json({ success: false, message: 'Driver account not found', data: null })
    if (typeof driver.sessionVersion === 'number' && (payload.ver ?? 0) !== (driver.sessionVersion ?? 0)) {
      return res.status(401).json({ success: false, message: 'Driver account session expired', data: null })
    }
    
    req.driver = driver
    next()
  } catch {
    res.status(401).json({ success: false, message: 'Invalid driver session', data: null })
  }
}

export async function optionalAuthenticateDriver(req, res, next) {
  try {
    const token = req.cookies?.driverToken || (req.get('authorization')?.startsWith('Bearer ') ? req.get('authorization').slice(7) : null)
    if (!token) { req.driver = null; return next() }
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] })
    let driver = await GovtDriver.findById(payload.sub).select('+sessionVersion').lean()
    if (!driver) {
      driver = await PrivateDriver.findById(payload.sub).select('+sessionVersion').lean()
      if (driver && !driver.driverType) driver.driverType = 'PRIVATE'
    }
    if (!driver) { req.driver = null; return next() }
    if (typeof driver.sessionVersion === 'number' && (payload.ver ?? 0) !== (driver.sessionVersion ?? 0)) {
      req.driver = null; return next()
    }
    req.driver = driver
    next()
  } catch {
    req.driver = null
    next()
  }
}
