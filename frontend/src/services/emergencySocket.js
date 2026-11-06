import { io } from 'socket.io-client'

const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5001'
const socket = io(socketUrl, { autoConnect: false, transports: ['websocket'] })

function connect() { if (!socket.connected) socket.connect(); return socket }

export function dispatchEmergency(payload) {
  connect()
  if (payload.userId) socket.emit('join_room', { userId: payload.userId })
  socket.emit('emergency:dispatch', { ...payload, targets: ['government-drivers', 'police-command'] })
  return { connected: true }
}

export function uploadEmergencyEvidence(payload) {
  socket.emit('emergency:evidence', payload)
}

export function joinDriverRoom(driverId, onEmergency) { connect(); socket.emit('join_room', { role: 'GOVT_DRIVER', userId: driverId }); if (onEmergency) socket.on('NEW_EMERGENCY_ALERT', onEmergency); return () => onEmergency && socket.off('NEW_EMERGENCY_ALERT', onEmergency) }
export function sendDriverLocation(payload) { connect(); socket.emit('driver_location_update', payload) }
export function onEmergencyCreated(callback) { connect(); socket.on('emergency:created', callback); return () => socket.off('emergency:created', callback) }
export function onDriverLocationUpdated(callback) { connect(); socket.on('DRIVER_LOCATION_UPDATED', callback); return () => socket.off('DRIVER_LOCATION_UPDATED', callback) }
