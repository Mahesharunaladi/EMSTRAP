import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'
import { initSafeGeolocation } from './utils/safeGeolocation'

initSafeGeolocation()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <Toaster position="top-center" toastOptions={{ style: { background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155' } }} />
  </StrictMode>,
)
