import axios from 'axios'

const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
const defaultBaseUrl = isLocal ? 'http://localhost:5001/api' : 'https://emstrap-backend-utuo.onrender.com/api'

const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL.trim() !== '') ? import.meta.env.VITE_API_URL : defaultBaseUrl,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' }
})

export default api
