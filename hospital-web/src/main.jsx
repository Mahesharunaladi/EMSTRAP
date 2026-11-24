import React from 'react'
import ReactDOM from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import HospitalDashboard from './HospitalDashboard'
import './hospital.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HospitalDashboard />
    <Toaster position="top-right" />
  </React.StrictMode>
)
