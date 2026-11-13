import { useEffect, useState } from 'react'
import api from '../services/api'
import { onBookingDriverAssigned, onBookingDriverLocationUpdated, onBookingStatusUpdated } from '../services/emergencySocket'

export default function useUserBookings() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    let delay = 4000

    const load = async () => {
      try {
        const { data } = await api.get('/bookings/mine')
        if (!active) return
        setBookings(data.data.bookings || [])
        setError('')
        delay = 4000
      } catch (requestError) {
        if (!active) return
        const status = requestError.response?.status
        if (status === 502 || status === 503) {
          delay = 10000
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

    // Realtime socket events for instantaneous driver location updates
    const unsubLocation = onBookingDriverLocationUpdated(payload => {
      if (!payload?.bookingId || !payload?.location) return
      setBookings(current => current.map(item => {
        if (String(item._id) === String(payload.bookingId)) {
          return { ...item, driverLocation: payload.location }
        }
        return item
      }))
    })

    const unsubAssigned = onBookingDriverAssigned(payload => {
      if (!payload?.booking?._id) return
      setBookings(current => current.map(item => {
        if (String(item._id) === String(payload.booking._id)) {
          return { ...item, ...payload.booking, driver: payload.driver }
        }
        return item
      }))
    })

    const unsubStatus = onBookingStatusUpdated(payload => {
      if (!payload?._id) return
      setBookings(current => current.map(item => {
        if (String(item._id) === String(payload._id)) {
          return { ...item, ...payload }
        }
        return item
      }))
    })

    return () => {
      active = false
      if (timerId) clearTimeout(timerId)
      unsubLocation()
      unsubAssigned()
      unsubStatus()
    }
  }, [])

  return { bookings, loading, error }
}
