import { useEffect, useState } from 'react'
import api from '../services/api'
import { onBookingDriverAssigned, onBookingDriverLocationUpdated, onBookingStatusUpdated, onDriverAssigned, onDriverLocationUpdated } from '../services/emergencySocket'

export default function useUserBookings() {
  const [bookings, setBookings] = useState([])
  const [emergencies, setEmergencies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    let delay = 4000

    const load = async () => {
      try {
        const [bookingsRes, emergenciesRes] = await Promise.allSettled([
          api.get('/bookings/mine'),
          api.get('/emergency/mine')
        ])

        if (!active) return

        if (bookingsRes.status === 'fulfilled') {
          setBookings(bookingsRes.value.data.data.bookings || [])
        }
        if (emergenciesRes.status === 'fulfilled') {
          setEmergencies(emergenciesRes.value.data.data.emergencies || [])
        }
        setError('')
        delay = 4000
      } catch (requestError) {
        if (!active) return
        const status = requestError.response?.status
        if (status === 502 || status === 503) {
          delay = 10000
        } else {
          setError(requestError.response?.data?.message || 'Could not load your records')
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

    // Realtime socket events for private bookings
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

    // Realtime socket events for emergency SOS
    const unsubEmergencyDriver = onDriverAssigned(payload => {
      if (!payload?.emergencyId) return
      setEmergencies(current => current.map(item => {
        if (String(item._id) === String(payload.emergencyId) || String(item.emergencyId) === String(payload.emergencyId)) {
          return { ...item, status: payload.status || 'ACCEPTED', driver: payload.driver }
        }
        return item
      }))
    })

    const unsubEmergencyLocation = onDriverLocationUpdated(payload => {
      if (!payload?.location) return
      setEmergencies(current => current.map(item => {
        if (item.status === 'ACCEPTED' || item.status === 'ARRIVED') {
          return { ...item, driverLocation: payload.location }
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
      unsubEmergencyDriver()
      unsubEmergencyLocation()
    }
  }, [])

  return { bookings, emergencies, loading, error }
}
