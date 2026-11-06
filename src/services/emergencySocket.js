import { io } from 'socket.io-client'

const socketUrl = import.meta.env.VITE_SOCKET_URL
const socket = socketUrl ? io(socketUrl, { autoConnect: false, transports: ['websocket'] }) : null

export function dispatchEmergency(payload) {
  if (!socket) return { connected: false }
  if (!socket.connected) socket.connect()
  socket.emit('emergency:dispatch', { ...payload, targets: ['government-drivers', 'police-command'] })
  return { connected: true }
}

export function uploadEmergencyEvidence(payload) {
  socket?.emit('emergency:evidence', payload)
}
