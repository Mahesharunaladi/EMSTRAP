import axios from 'axios'

const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
let baseUrl = (import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL.trim() !== '')
  ? import.meta.env.VITE_API_URL
  : (isLocal ? 'http://localhost:5001/api' : 'https://emstrap-backend-utuo.onrender.com/api')

if (baseUrl.includes('emstrap-backend.onrender.com') && !baseUrl.includes('emstrap-backend-utuo.onrender.com')) {
  baseUrl = baseUrl.replace('emstrap-backend.onrender.com', 'emstrap-backend-utuo.onrender.com')
}

const api = axios.create({
  baseURL: baseUrl,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' }
})

export default api
