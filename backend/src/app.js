import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import authRoutes from './routes/authRoutes.js'
import locationRoutes from './routes/locationRoutes.js'
import driverRoutes from './routes/driverRoutes.js'
import policeRoutes from './routes/policeRoutes.js'

const app = express()
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map(origin => origin.trim())
if (process.env.NODE_ENV !== 'production' && !allowedOrigins.includes('http://localhost:5174')) allowedOrigins.push('http://localhost:5174')

app.use(cors({ origin: allowedOrigins, credentials: true }))
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

app.get('/', (_req, res) => res.json({ success: true, message: 'EmSTraP API is running', data: { health: '/api/health', auth: '/api/auth' } }))
app.get('/api/health', (_req, res) => res.json({ success: true, message: 'EmSTraP API is healthy', data: { service: 'backend', timestamp: new Date().toISOString() } }))
app.use('/api/auth', authRoutes)
app.use('/api/location', locationRoutes)
app.use('/api/driver', driverRoutes)
app.use('/api/police', policeRoutes)

app.use((error, _req, res, _next) => {
  console.error('[api]', error)
    const isDatabaseError = error.name?.includes('Mongo') || error.message?.includes('before initial connection')
    const status = isDatabaseError ? 503 : (error.statusCode || 500)
    const message = isDatabaseError ? 'Database unavailable. Check backend MongoDB configuration.' : (error.message || 'Internal server error')
    res.status(status).json({ success: false, message, data: null })
})

export default app
