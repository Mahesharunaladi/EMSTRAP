import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'

const app = express()
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map(origin => origin.trim())

app.use(cors({ origin: allowedOrigins, credentials: true }))
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

app.get('/api/health', (_req, res) => res.json({ success: true, message: 'EmSTraP API is healthy', data: { service: 'backend', timestamp: new Date().toISOString() } }))

app.use((error, _req, res, _next) => {
  console.error('[api]', error)
  res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Internal server error', data: null })
})

export default app
