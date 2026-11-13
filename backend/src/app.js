import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import authRoutes from './routes/authRoutes.js'
import locationRoutes from './routes/locationRoutes.js'
import driverRoutes from './routes/driverRoutes.js'
import policeRoutes from './routes/policeRoutes.js'
import bookingRoutes from './routes/bookingRoutes.js'
import emergencyRoutes from './routes/emergencyRoutes.js'
import { corsOriginDelegate, isAllowedOrigin } from './config/allowedOrigins.js'

const app = express()
app.set('trust proxy', 1)

app.use(cors({ origin: corsOriginDelegate, credentials: true }))
app.use((req, res, next) => {
  const origin = req.get('origin')
  if (origin && !isAllowedOrigin(origin)) return res.status(403).json({ success: false, message: 'Origin is not allowed', data: null })
  next()
})
app.use((req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer', 'Permissions-Policy': 'camera=(self), geolocation=(self), microphone=()' })
  if (process.env.NODE_ENV === 'production') res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  next()
})
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true, limit: '32kb', parameterLimit: 100 }))
app.use(cookieParser())

app.get('/', (_req, res) => res.json({ success: true, message: 'EmSTraP API is running', data: { health: '/api/health', auth: '/api/auth' } }))
app.get('/api/health', (_req, res) => res.json({ success: true, message: 'EmSTraP API is healthy', data: { service: 'backend', timestamp: new Date().toISOString() } }))
app.use('/api/auth', authRoutes)
app.use('/api/location', locationRoutes)
app.use('/api/driver', driverRoutes)
app.use('/api/bookings', bookingRoutes)
app.use('/api/police', policeRoutes)
app.use('/api/emergency', emergencyRoutes)

app.use((error, _req, res, _next) => {
  console.error('[api]', error)
    const isDatabaseError = error.name?.includes('Mongo') || error.message?.includes('before initial connection')
    const status = isDatabaseError ? 503 : (error.statusCode || 500)
    const message = isDatabaseError ? 'Database unavailable.' : (status < 500 ? error.message : 'Internal server error')
    res.status(status).json({ success: false, message, data: null })
})

export default app
