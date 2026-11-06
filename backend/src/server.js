import 'dotenv/config'
import http from 'node:http'
import { Server } from 'socket.io'
import app from './app.js'
import { connectDatabases, disconnectDatabases } from './config/db.js'
import { registerSocketHandlers } from './socket/socketHandler.js'

const port = Number(process.env.PORT || 5000)
const httpServer = http.createServer(app)
const io = new Server(httpServer, {
  cors: { origin: (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map(origin => origin.trim()), credentials: true },
  transports: ['websocket', 'polling'],
})

registerSocketHandlers(io)

async function start() {
  try {
    await connectDatabases()
    httpServer.listen(port, () => console.log(`[server] EmSTraP API listening on http://localhost:${port}`))
  } catch (error) {
    console.error('[server] Unable to connect to databases:', error.message)
    process.exitCode = 1
  }
}

async function shutdown(signal) {
  console.log(`[server] ${signal} received; shutting down`)
  io.close()
  httpServer.close(async () => { await disconnectDatabases(); process.exit(0) })
}

process.once('SIGINT', () => shutdown('SIGINT'))
process.once('SIGTERM', () => shutdown('SIGTERM'))
start()
