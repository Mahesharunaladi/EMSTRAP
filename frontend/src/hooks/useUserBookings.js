import { useEffect, useState } from 'react'
import api from '../services/api'

export default function useUserBookings() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const { data } = await api.get('/bookings/mine')
        if (!active) return
        setBookings(data.data.bookings || [])
        setError('')
      } catch (requestError) {
        if (!active) return
        setError(requestError.response?.data?.message || 'Could not load your ambulance bookings')
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    const timer = window.setInterval(load, 5000)
    return () => { active = false; window.clearInterval(timer) }
  }, [])

  return { bookings, loading, error }
}
