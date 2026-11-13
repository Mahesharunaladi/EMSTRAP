import { useEffect, useState } from 'react'
import api from '../services/api'

export default function useUserBookings() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    let delay = 6000

    const load = async () => {
      try {
        const { data } = await api.get('/bookings/mine')
        if (!active) return
        setBookings(data.data.bookings || [])
        setError('')
        delay = 6000
      } catch (requestError) {
        if (!active) return
        const status = requestError.response?.status
        if (status === 502 || status === 503) {
          // Cold start or temporary restart: back off and don't spam errors
          delay = 12000
        } else {
          setError(requestError.response?.data?.message || 'Could not load your ambulance bookings')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    let timerId = null
    const loop = () => {
      timerId = setTimeout(async () => {
        await load()
        if (active) loop()
      }, delay)
    }
    loop()

    return () => {
      active = false
      if (timerId) clearTimeout(timerId)
    }
  }, [])

  return { bookings, loading, error }
}
