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
export function sendUserLocation(payload) { connect(); socket.emit('user_location_update', payload) }
export function onEmergencyCreated(callback) { connect(); socket.on('emergency:created', callback); return () => socket.off('emergency:created', callback) }
export function onDriverLocationUpdated(callback) { connect(); socket.on('DRIVER_LOCATION_UPDATED', callback); return () => socket.off('DRIVER_LOCATION_UPDATED', callback) }
export function acceptEmergency(emergencyId, driverId) { connect(); socket.emit('driver_accept_emergency', { emergencyId, driverId }) }
export function joinPoliceRoom(onAlert, onAssignment, onDriverLocation, onUserLocation) { connect(); socket.emit('join_room', { role: 'POLICE' }); if (onAlert) socket.on('NEW_EMERGENCY_ALERT', onAlert); if (onAssignment) socket.on('DRIVER_ASSIGNED', onAssignment); if (onDriverLocation) socket.on('DRIVER_LOCATION_UPDATED', onDriverLocation); if (onUserLocation) socket.on('USER_LOCATION_UPDATED', onUserLocation); return () => { if (onAlert) socket.off('NEW_EMERGENCY_ALERT', onAlert); if (onAssignment) socket.off('DRIVER_ASSIGNED', onAssignment); if (onDriverLocation) socket.off('DRIVER_LOCATION_UPDATED', onDriverLocation); if (onUserLocation) socket.off('USER_LOCATION_UPDATED', onUserLocation) } }
export function onUserLocationUpdated(callback) { connect(); socket.on('USER_LOCATION_UPDATED', callback); return () => socket.off('USER_LOCATION_UPDATED', callback) }
