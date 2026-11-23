import axios from 'axios'

const isLocalBrowser = typeof window !== 'undefined' &&
  !navigator.userAgent.includes('EmSTraP-App') &&
  window.location.protocol !== 'capacitor:' &&
  window.location.protocol !== 'content:' &&
  window.location.protocol !== 'file:' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
  import.meta.env.DEV

let baseUrl = (import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL.trim() !== '')
  ? import.meta.env.VITE_API_URL
  : (isLocalBrowser ? 'http://localhost:5001/api' : 'https://emstrap-backend-utuo.onrender.com/api')

if (baseUrl.includes('emstrap-backend.onrender.com') && !baseUrl.includes('emstrap-backend-utuo.onrender.com')) {
  baseUrl = baseUrl.replace('emstrap-backend.onrender.com', 'emstrap-backend-utuo.onrender.com')
}

const api = axios.create({
  baseURL: baseUrl,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' }
})

api.interceptors.request.use(config => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('emstrap_token') || localStorage.getItem('emstrap_driver_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

export default api
