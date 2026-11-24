import { io } from 'socket.io-client'

const isLocalBrowser = typeof window !== 'undefined' &&
  !navigator.userAgent.includes('EmSTraP-App') &&
  window.location.protocol !== 'capacitor:' &&
  window.location.protocol !== 'content:' &&
  window.location.protocol !== 'file:' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
  import.meta.env.DEV

let socketUrl = (import.meta.env.VITE_SOCKET_URL && import.meta.env.VITE_SOCKET_URL.trim() !== '')
  ? import.meta.env.VITE_SOCKET_URL
  : (isLocalBrowser ? 'http://localhost:5001' : 'https://emstrap-backend-utuo.onrender.com')

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
  auth: cb => {
    const token = typeof window !== 'undefined' ? (localStorage.getItem('emstrap_hospital_token') || localStorage.getItem('emstrap_token')) : null
    cb({ token })
  }
})

function connect() {
  if (!socket.connected && !socket.active) {
    socket.connect()
  }
  return socket
}

export function joinHospitalRoom(onAlert, onAssignment, onDriverLocation, onStatusUpdated, onEvidenceUpdated) {
  connect()
  const emitJoin = () => {
    socket.emit('join_room', { role: 'HOSPITAL' })
    socket.emit('join_hospital_room')
  }
  emitJoin()
  socket.on('connect', emitJoin)
  socket.on('reconnect', emitJoin)

  if (onAlert) {
    socket.on('NEW_EMERGENCY_ALERT', onAlert)
    socket.on('police_emergency_alert', onAlert)
  }
  if (onAssignment) socket.on('DRIVER_ASSIGNED', onAssignment)
  if (onDriverLocation) socket.on('DRIVER_LOCATION_UPDATED', onDriverLocation)
  if (onStatusUpdated) {
    socket.on('HOSPITAL_STATUS_UPDATED', onStatusUpdated)
    socket.on('EMERGENCY_STATUS_UPDATED', onStatusUpdated)
  }
  if (onEvidenceUpdated) {
    socket.on('emergency_evidence_updated', onEvidenceUpdated)
    socket.on('EMERGENCY_EVIDENCE_ADDED', onEvidenceUpdated)
  }

  return () => {
    socket.off('connect', emitJoin)
    socket.off('reconnect', emitJoin)
    if (onAlert) {
      socket.off('NEW_EMERGENCY_ALERT', onAlert)
      socket.off('police_emergency_alert', onAlert)
    }
    if (onAssignment) socket.off('DRIVER_ASSIGNED', onAssignment)
    if (onDriverLocation) socket.off('DRIVER_LOCATION_UPDATED', onDriverLocation)
    if (onStatusUpdated) {
      socket.off('HOSPITAL_STATUS_UPDATED', onStatusUpdated)
      socket.off('EMERGENCY_STATUS_UPDATED', onStatusUpdated)
    }
    if (onEvidenceUpdated) {
      socket.off('emergency_evidence_updated', onEvidenceUpdated)
      socket.off('EMERGENCY_EVIDENCE_ADDED', onEvidenceUpdated)
    }
  }
}
