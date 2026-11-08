import jwt from 'jsonwebtoken'
import { User } from '../config/db.js'

function getToken(req) {
  const bearer = req.get('authorization')
  if (bearer?.startsWith('Bearer ')) return bearer.slice(7)
  return req.cookies?.token
}

export async function authenticate(req, res, next) {
  try {
    const token = getToken(req)
    if (!token) return res.status(401).json({ success: false, message: 'Authentication required', data: null })
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] })
    const user = await User.findById(payload.sub).lean()
    if (!user || user.role !== payload.role) return res.status(401).json({ success: false, message: 'Account no longer exists', data: null })
    req.user = user
    next()
  } catch (error) {
    return res.status(401).json({ success: false, message: error.name === 'TokenExpiredError' ? 'Session expired' : 'Invalid authentication token', data: null })
  }
}

export function authorizeRoles(allowedRoles = []) {
  return (req, res, next) => allowedRoles.includes(req.user?.role) ? next() : res.status(403).json({ success: false, message: 'You do not have permission for this action', data: null })
}
