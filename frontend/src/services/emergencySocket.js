import { io } from 'socket.io-client'
import api from './api'

const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
let socketUrl = (import.meta.env.VITE_SOCKET_URL && import.meta.env.VITE_SOCKET_URL.trim() !== '') ? import.meta.env.VITE_SOCKET_URL : (isLocal ? 'http://localhost:5001' : 'https://emstrap-backend-utuo.onrender.com')
if (socketUrl.includes('emstrap-backend.onrender.com') && !socketUrl.includes('emstrap-backend-utuo.onrender.com')) {
  socketUrl = socketUrl.replace('emstrap-backend.onrender.com', 'emstrap-backend-utuo.onrender.com')
}
const socket = io(socketUrl, {
  autoConnect: false,
  transports: ['websocket'],
  upgrade: false,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
  withCredentials: true,
  auth: (cb) => {
    const token = typeof window !== 'undefined' ? (localStorage.getItem('emstrap_token') || localStorage.getItem('emstrap_driver_token')) : null
    cb({ token })
  }
})

function connect() {
  if (!socket.connected && !socket.active) {
    socket.connect()
  }
  return socket
}

export async function dispatchEmergency(payload) {
  try {
    const { data } = await api.post('/emergency/dispatch', payload)
    if (socket.connected && payload.userId) {
      socket.emit('join_room', { userId: payload.userId })
    }
    return data.data
  } catch (httpError) {
    return new Promise((resolve, reject) => {
      connect()
      if (payload.userId) socket.emit('join_room', { userId: payload.userId })
      socket.timeout(10000).emit('emergency:dispatch', { ...payload, targets: ['government-drivers', 'police-command'] }, (error, response) => {
        if (error) return reject(new Error('Emergency dispatch timed out. Check your connection and try again.'))
        if (!response?.success) return reject(new Error(response?.message || 'Emergency dispatch failed. Please try again.'))
        resolve(response.data)
      })
    })
  }
}

export function uploadEmergencyEvidence(payload) {
  socket.emit('emergency:evidence', payload)
}

export function joinDriverRoom(driverId, onEmergency, driverType = 'GOVERNMENT', onAssignment, onBooking, onBookingAssignment) {
  connect()
  const emitJoin = () => {
    socket.emit('join_room', { role: driverType === 'PRIVATE' ? 'PRIVATE_DRIVER' : 'GOVT_DRIVER', userId: driverId })
  }
  emitJoin()
  socket.on('connect', emitJoin)

  if (onEmergency && driverType === 'GOVERNMENT') socket.on('NEW_EMERGENCY_ALERT', onEmergency)
  if (onAssignment && driverType === 'GOVERNMENT') socket.on('DRIVER_ASSIGNED', onAssignment)
  if (onBooking && driverType === 'PRIVATE') socket.on('NEW_PRIVATE_BOOKING', onBooking)
  if (onBookingAssignment && driverType === 'PRIVATE') socket.on('BOOKING_ASSIGNED', onBookingAssignment)
  return () => {
    socket.off('connect', emitJoin)
    if (onEmergency && driverType === 'GOVERNMENT') socket.off('NEW_EMERGENCY_ALERT', onEmergency)
    if (onAssignment && driverType === 'GOVERNMENT') socket.off('DRIVER_ASSIGNED', onAssignment)
    if (onBooking && driverType === 'PRIVATE') socket.off('NEW_PRIVATE_BOOKING', onBooking)
    if (onBookingAssignment && driverType === 'PRIVATE') socket.off('BOOKING_ASSIGNED', onBookingAssignment)
  }
}
export function sendDriverLocation(payload) { connect(); socket.emit('driver_location_update', { emergencyId: payload.emergencyId, lat: payload.lat, lng: payload.lng, heading: payload.heading }) }
export function sendUserLocation(payload) { connect(); socket.emit('user_location_update', payload) }
export function onEmergencyCreated(callback) { connect(); socket.on('emergency:created', callback); return () => socket.off('emergency:created', callback) }
export function onDriverLocationUpdated(callback) { connect(); socket.on('DRIVER_LOCATION_UPDATED', callback); return () => socket.off('DRIVER_LOCATION_UPDATED', callback) }
export function acceptEmergency(emergencyId) { connect(); socket.emit('driver_accept_emergency', { emergencyId }) }
export function joinPoliceRoom(onAlert, onAssignment, onDriverLocation, onUserLocation) { connect(); socket.emit('join_room', { role: 'POLICE' }); if (onAlert) socket.on('NEW_EMERGENCY_ALERT', onAlert); if (onAssignment) socket.on('DRIVER_ASSIGNED', onAssignment); if (onDriverLocation) socket.on('DRIVER_LOCATION_UPDATED', onDriverLocation); if (onUserLocation) socket.on('USER_LOCATION_UPDATED', onUserLocation); return () => { if (onAlert) socket.off('NEW_EMERGENCY_ALERT', onAlert); if (onAssignment) socket.off('DRIVER_ASSIGNED', onAssignment); if (onDriverLocation) socket.off('DRIVER_LOCATION_UPDATED', onDriverLocation); if (onUserLocation) socket.off('USER_LOCATION_UPDATED', onUserLocation) } }
export function onUserLocationUpdated(callback) { connect(); socket.on('USER_LOCATION_UPDATED', callback); return () => socket.off('USER_LOCATION_UPDATED', callback) }
