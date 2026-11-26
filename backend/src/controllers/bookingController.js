import { AmbulanceBooking, BookingUser, GovtDriver, PrivateDriver, User } from '../config/db.js'
import { canDriverReceiveDispatch } from '../utils/driverDispatch.js'
import { sendFcmNotification } from '../services/fcmService.js'

const activeBookingStatuses = ['ACCEPTED', 'STARTED']

/**
 * Distance-Based Dynamic Fare Rates:
 * 1. Standard Transport (STANDARD): Base ₹250 + ₹25/km
 * 2. Maternity Support (PREGNANCY): Base ₹400 + ₹35/km
 * 3. ICU / Advanced Life Support (ICU): Base ₹800 + ₹60/km
 * 4. Bariatric / Custom (SPECIAL): Base ₹600 + ₹45/km
 */
export const TIER_CONFIG = {
  STANDARD: { baseFare: 250, perKmRate: 25, label: 'Standard Transport' },
  PREGNANCY: { baseFare: 400, perKmRate: 35, label: 'Maternity Support' },
  ICU: { baseFare: 800, perKmRate: 60, label: 'ICU / Advanced Life Support' },
  SPECIAL: { baseFare: 600, perKmRate: 45, label: 'Oxygen' }
}

const driverRooms = ['govt_drivers_channel', 'private_drivers_channel']
const userRoom = id => `user:${id}`

function validLocation(value) {
  const lat = Number(value?.lat != null ? value.lat : (Array.isArray(value) ? value[1] : value?.latitude))
  const lng = Number(value?.lng != null ? value.lng : (Array.isArray(value) ? value[0] : value?.longitude))
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
    ? { lat, lng, source: value.source === 'browser-gps' ? 'browser-gps' : 'user-selected' }
    : null
}

function calculateDistanceKm(loc1, loc2) {
  if (!loc1 || !loc2) return 2.0
  const R = 6371
  const dLat = (loc2.lat - loc1.lat) * (Math.PI / 180)
  const dLng = (loc2.lng - loc1.lng) * (Math.PI / 180)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(loc1.lat * (Math.PI / 180)) * Math.cos(loc2.lat * (Math.PI / 180)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const directDistance = R * c
  // Road factor 1.3x with minimum chargeable distance 2 km
  return Math.max(2.0, Number((directDistance * 1.3).toFixed(1)))
}

function publicBooking(booking) {
  return {
    _id: booking._id, tier: booking.tier, status: booking.status,
    pickup: booking.pickup, pickupLocation: booking.pickupLocation,
    destination: booking.destination, destinationLocation: booking.destinationLocation,
    driverLocation: booking.driverLocation, assignedDriverId: booking.assignedDriverId,
    assignedDriverType: booking.assignedDriverType, createdAt: booking.createdAt,
    price: booking.price, totalFare: booking.price, estimatedFare: booking.price,
    distanceKm: booking.distanceKm,
    customerName: booking.customerName,
    customerPhone: booking.customerPhone,
    messages: booking.messages || [],
    cancelledByDrivers: booking.cancelledByDrivers || [],
  }
}

export async function createBooking(req, res, next) {
  try {
    if (req.user.role !== 'USER') return res.status(403).json({ success: false, message: 'A user account is required to book an ambulance', data: null })
    const tier = String(req.body.tier || '').toUpperCase()
    const pickup = typeof req.body.pickup === 'string' ? req.body.pickup.trim() : ''
    const destination = typeof req.body.destination === 'string' ? req.body.destination.trim() : ''
    const pickupLocation = validLocation(req.body.pickupLocation)
    const destinationLocation = validLocation(req.body.destinationLocation)

    if (!Object.hasOwn(TIER_CONFIG, tier) || !pickup || pickup.length > 500 || !destination || destination.length > 500 || !pickupLocation || !destinationLocation) {
      return res.status(400).json({ success: false, message: 'Choose a service and provide pickup and drop-off addresses with valid map locations', data: null })
    }

    const bookingUser = await BookingUser.findOneAndUpdate(
      { email: req.user.email },
      { $set: { name: req.user.name, email: req.user.email, phone: req.user.phone || '' } },
      { upsert: true, returnDocument: 'after', runValidators: true },
    )

    // Calculate dynamic distance and pricing
    const config = TIER_CONFIG[tier]
    const distanceKm = Number(req.body.distanceKm) > 0 ? Number(req.body.distanceKm) : calculateDistanceKm(pickupLocation, destinationLocation)
    const calculatedFare = Math.round(config.baseFare + (distanceKm * config.perKmRate))

    const booking = await AmbulanceBooking.create({
      userId: bookingUser._id,
      authUserId: req.user._id,
      customerName: req.user.name,
      customerPhone: req.user.phone || '',
      tier,
      status: 'PENDING',
      pickup,
      pickupLocation,
      destination,
      destinationLocation,
      price: calculatedFare,
      distanceKm,
    })

    const payload = publicBooking(booking)
    const io = req.app.get('io')
    if (io) io.to('private_drivers_channel').emit('NEW_PRIVATE_BOOKING', payload)

    // Trigger High-Priority FCM Push Notification to ON DUTY Private Drivers
    Promise.all([
      PrivateDriver.find({
        $or: [{ isOnDuty: true }, { isOnDuty: { $exists: false } }],
        fcmToken: { $exists: true, $ne: null, $ne: '' }
      }).select('fcmToken fcmTokens').lean().catch(() => []),
      GovtDriver.find({
        $or: [{ isOnDuty: true }, { isOnDuty: { $exists: false } }],
        driverType: 'PRIVATE',
        fcmToken: { $exists: true, $ne: null, $ne: '' }
      }).select('fcmToken fcmTokens').lean().catch(() => [])
    ]).then(([pDrivers, gDrivers]) => {
      const tokens = []
      ;[...pDrivers, ...gDrivers].forEach(d => {
        if (d.fcmToken) tokens.push(d.fcmToken)
        if (Array.isArray(d.fcmTokens)) tokens.push(...d.fcmTokens)
      })
      const uniqueTokens = [...new Set(tokens.filter(Boolean))]
      if (uniqueTokens.length > 0) {
        sendFcmNotification({
          tokens: uniqueTokens,
          title: '🚑 NEW AMBULANCE BOOKING',
          body: 'New private ambulance ride request received.',
          channelId: 'emstrap_private_booking_buzzer_v4',
          sound: 'private_driver_alert',
          data: {
            bookingId: String(booking._id),
            type: 'PRIVATE_BOOKING',
          }
        }).catch(e => console.warn('[FCM Private Booking Warning]', e.message))
      }
    }).catch(() => {})

    res.status(201).json({
      success: true,
      message: 'Ambulance request sent to available drivers',
      data: { booking: payload }
    })
  } catch (error) { next(error) }
}

export async function getMyBookings(req, res, next) {
  try {
    if (req.user.role !== 'USER') return res.status(403).json({ success: false, message: 'A user account is required to view ambulance bookings', data: null })
    let bookings = []
    try {
      bookings = await AmbulanceBooking.find({ authUserId: req.user._id }).sort({ createdAt: -1 }).limit(50).lean()
      if (!bookings.length) {
        const bookingUser = await BookingUser.findOne({ email: req.user.email }).select('_id').lean()
        if (bookingUser) bookings = await AmbulanceBooking.find({ userId: bookingUser._id }).sort({ createdAt: -1 }).limit(50).lean()
      }
    } catch (dbErr) {
      console.warn('[bookings] DB query temporary warning:', dbErr.message)
      return res.json({ success: true, message: 'Your ambulance bookings', data: { bookings: [] } })
    }

    const driverIds = [...new Set((bookings || []).map(booking => booking.assignedDriverId?.toString()).filter(Boolean))]
    let drivers = []
    try {
      drivers = driverIds.length
        ? await GovtDriver.find({ _id: { $in: driverIds } }).select('name phone driverType selfie').lean()
        : []
    } catch (_) { drivers = [] }
    const driversById = new Map((drivers || []).map(driver => [driver._id.toString(), driver]))

    const rides = (bookings || []).map(booking => {
      const assignedDriver = booking.assignedDriverId && driversById.get(booking.assignedDriverId.toString())
      return {
        ...publicBooking(booking),
        ...(assignedDriver ? {
          driver: {
            name: assignedDriver.name,
            phone: assignedDriver.phone,
            driverType: assignedDriver.driverType,
            photo: assignedDriver.selfie?.url || null,
          },
        } : {}),
      }
    })

    res.json({ success: true, message: 'Your ambulance bookings', data: { bookings: rides } })
  } catch (error) { next(error) }
}

export async function getDriverBookings(req, res, next) {
  try {
    if (req.driver.driverType === 'GOVERNMENT') {
      return res.json({ success: true, message: 'Government driver view', data: { bookings: [], driverStatus: req.driver.status, canReceiveBookings: false } })
    }
    const canReceive = canDriverReceiveDispatch(req.driver)
    if (!canReceive) {
      return res.status(403).json({ success: false, message: 'Driver approval or document verification is required before accepting bookings', data: { bookings: [], driverStatus: req.driver.status, canReceiveBookings: false } })
    }
    const bookings = await AmbulanceBooking.find({
      $or: [
        { status: { $in: ['PENDING', 'FINDING_AMBULANCE'] }, assignedDriverId: null, cancelledByDrivers: { $ne: req.driver._id } },
        { assignedDriverId: req.driver._id, status: { $in: ['ACCEPTED', 'ON_THE_WAY', 'ARRIVED', 'STARTED'] } },
      ],
    }).sort({ createdAt: -1 }).limit(20).lean()

    const driverBookings = bookings.map(booking => ({
      ...publicBooking(booking),
      ...(String(booking.assignedDriverId || '') === String(req.driver._id) ? { customerName: booking.customerName, customerPhone: booking.customerPhone } : {}),
    }))
    res.json({ success: true, message: 'Available ambulance bookings', data: { bookings: driverBookings, driverStatus: req.driver.status, canReceiveBookings: true } })
  } catch (error) { next(error) }
}

export async function acceptDriverBooking(req, res, next) {
  try {
    const driver = await GovtDriver.findById(req.driver._id).lean()
    if (driver.driverType === 'GOVERNMENT') {
      return res.status(403).json({ success: false, message: 'Government drivers can only accept emergency SOS requests. Normal rides are for private drivers only.', data: null })
    }
    if (!canDriverReceiveDispatch(driver)) return res.status(403).json({ success: false, message: 'Driver approval or document verification is required before accepting bookings', data: null })
    
    const initialLocation = driver.currentLocation || { lat: 12.9716, lng: 77.5946, source: 'driver-accepted', updatedAt: new Date() }
    const booking = await AmbulanceBooking.findOneAndUpdate(
      { _id: req.params.bookingId, status: { $in: ['PENDING', 'FINDING_AMBULANCE'] }, assignedDriverId: null },
      { $set: { status: 'ACCEPTED', assignedDriverId: driver._id, assignedDriverType: 'PRIVATE', driverLocation: initialLocation } },
      { returnDocument: 'after', runValidators: true },
    ).lean()
    if (!booking) return res.status(409).json({ success: false, message: 'This booking was already accepted or is no longer available', data: null })

    const io = req.app.get('io')
    const assignment = { booking: { ...publicBooking(booking), customerName: booking.customerName, customerPhone: booking.customerPhone }, driver: { id: driver._id, name: driver.name, phone: driver.phone, driverType: driver.driverType } }
    if (io) {
      io.to('private_drivers_channel').emit('BOOKING_ASSIGNED', { booking: publicBooking(booking), driver: { id: driver._id } })
      if (booking.authUserId) {
        io.to(userRoom(booking.authUserId.toString())).emit('BOOKING_DRIVER_ASSIGNED', assignment)
        io.to(`booking_${booking._id}`).emit('BOOKING_DRIVER_ASSIGNED', assignment)
        io.to(userRoom(booking.authUserId.toString())).emit('BOOKING_DRIVER_LOCATION_UPDATED', { bookingId: booking._id, driverId: driver._id, location: initialLocation })
        io.to(`booking_${booking._id}`).emit('BOOKING_DRIVER_LOCATION_UPDATED', { bookingId: booking._id, driverId: driver._id, location: initialLocation })
      }
    }

    // Send FCM push to User notifying ambulance assigned
    if (booking.authUserId) {
      User.findById(booking.authUserId).select('fcmToken fcmTokens').lean().then(userDoc => {
        const uTokens = []
        if (userDoc?.fcmToken) uTokens.push(userDoc.fcmToken)
        if (Array.isArray(userDoc?.fcmTokens)) uTokens.push(...userDoc.fcmTokens)
        const validUTokens = [...new Set(uTokens.filter(Boolean))]
        if (validUTokens.length > 0) {
          sendFcmNotification({
            tokens: validUTokens,
            title: '🚑 Ambulance Assigned — Driver on the way!',
            body: `${driver.name || 'Private Ambulance Unit'} has accepted your booking and is en route.`,
            channelId: 'emstrap_private_booking_buzzer_v4',
            sound: 'private_driver_alert',
            data: {
              bookingId: String(booking._id),
              type: 'BOOKING_ASSIGNED',
            }
          }).catch(() => {})
        }
      }).catch(() => {})
    }
    res.json({ success: true, message: 'Booking accepted', data: assignment })
  } catch (error) { next(error) }
}

export async function updateDriverBookingStatus(req, res, next) {
  try {
    const status = String(req.body.status || '').toUpperCase()
    if (!['STARTED', 'COMPLETED'].includes(status)) return res.status(400).json({ success: false, message: 'Choose STARTED or COMPLETED', data: null })
    const allowed = status === 'STARTED' ? ['ACCEPTED'] : ['STARTED']
    const booking = await AmbulanceBooking.findOneAndUpdate(
      { _id: req.params.bookingId, assignedDriverId: req.driver._id, status: { $in: allowed } },
      { $set: { status } }, { returnDocument: 'after', runValidators: true },
    ).lean()
    if (!booking) return res.status(409).json({ success: false, message: 'Booking status has changed or is not assigned to this driver', data: null })
    const payload = publicBooking(booking)
    const io = req.app.get('io')
    if (io) {
      io.to(`booking_${booking._id}`).emit('BOOKING_STATUS_UPDATED', payload)
      if (booking.authUserId) io.to(userRoom(booking.authUserId.toString())).emit('BOOKING_STATUS_UPDATED', payload)
    }
    res.json({ success: true, message: 'Booking status updated', data: { booking: payload } })
  } catch (error) { next(error) }
}

export async function updateDriverBookingLocation(req, res, next) {
  try {
    const location = validLocation(req.body.location)
    if (!location) return res.status(400).json({ success: false, message: 'Valid driver coordinates are required', data: null })
    const booking = await AmbulanceBooking.findOneAndUpdate(
      { _id: req.params.bookingId, assignedDriverId: req.driver._id, status: { $in: activeBookingStatuses } },
      { $set: { driverLocation: { ...location, updatedAt: new Date() } } }, { returnDocument: 'after', runValidators: true },
    ).lean()
    if (!booking) return res.status(403).json({ success: false, message: 'Location sharing is limited to your active assigned booking', data: null })
    await GovtDriver.updateOne({ _id: req.driver._id }, { $set: { currentLocation: { ...location, updatedAt: new Date() } } })
    const payload = { bookingId: booking._id, driverId: req.driver._id, location }
    const io = req.app.get('io')
    if (io && booking.authUserId) io.to(userRoom(booking.authUserId.toString())).emit('BOOKING_DRIVER_LOCATION_UPDATED', payload)
    res.json({ success: true, message: 'Driver location updated', data: payload })
  } catch (error) { next(error) }
}


export async function getBookingById(req, res, next) {
  try {
    const booking = await AmbulanceBooking.findById(req.params.bookingId).lean()
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found', data: null })
    }

    let driver = null
    if (booking.assignedDriverId) {
      driver = await GovtDriver.findById(booking.assignedDriverId).select('name phone driverType selfie currentLocation vehicleNumber').lean()
        || await PrivateDriver.findById(booking.assignedDriverId).select('name phone driverType selfie currentLocation vehicleNumber').lean()
    }

    return res.json({
      success: true,
      message: 'Booking details',
      data: {
        booking: {
          ...publicBooking(booking),
          driver: driver ? {
            id: driver._id,
            name: driver.name,
            phone: driver.phone,
            driverType: driver.driverType || 'PRIVATE',
            vehicleNumber: driver.vehicleNumber || null,
            photo: driver.selfie?.url || null,
            currentLocation: driver.currentLocation || null,
          } : null,
        }
      }
    })
  } catch (error) { next(error) }
}

export async function sendBookingMessage(req, res, next) {
  try {
    const text = typeof req.body.text === 'string' ? req.body.text.trim() : ''
    if (!text) {
      return res.status(400).json({ success: false, message: 'Message text is required', data: null })
    }

    const isDriver = Boolean(req.driver?._id)
    const senderRole = isDriver ? 'DRIVER' : 'USER'
    const senderName = isDriver ? (req.driver.name || 'Private Driver') : (req.user?.name || 'Patient')

    const msgObj = {
      senderRole,
      senderName,
      text: text.slice(0, 1000),
      timestamp: new Date(),
    }

    const booking = await AmbulanceBooking.findByIdAndUpdate(
      req.params.bookingId,
      { $push: { messages: msgObj } },
      { returnDocument: 'after', runValidators: true }
    ).lean()

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found', data: null })
    }

    const io = req.app.get('io')
    if (io) {
      const eventPayload = {
        bookingId: String(booking._id),
        message: booking.messages[booking.messages.length - 1] || msgObj,
        messages: booking.messages || [],
      }
      io.to(`booking_${booking._id}`).emit('booking_chat_message', eventPayload)
      if (booking.authUserId) {
        io.to(userRoom(booking.authUserId.toString())).emit('booking_chat_message', eventPayload)
      }
      if (booking.assignedDriverId) {
        io.to(userRoom(booking.assignedDriverId.toString())).emit('booking_chat_message', eventPayload)
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Message sent',
      data: {
        message: booking.messages[booking.messages.length - 1] || msgObj,
        messages: booking.messages || [],
      }
    })
  } catch (error) { next(error) }
}

export async function cancelBookingByDriver(req, res, next) {
  try {
    const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : 'Driver unavailable'
    const bookingId = req.params.bookingId
    const driverId = req.driver._id

    // Allow cancelling either an accepted booking assigned to this driver, or declining a PENDING/FINDING_AMBULANCE one
    const existing = await AmbulanceBooking.findById(bookingId).lean()
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Booking not found', data: null })
    }

    if (existing.status === 'COMPLETED' || existing.status === 'CANCELLED') {
      return res.status(409).json({ success: false, message: 'Cannot cancel a completed or already cancelled booking', data: null })
    }

    const isAssignedToMe = existing.assignedDriverId && String(existing.assignedDriverId) === String(driverId)
    const isPending = ['PENDING', 'FINDING_AMBULANCE'].includes(existing.status) && !existing.assignedDriverId

    if (!isAssignedToMe && !isPending) {
      return res.status(403).json({ success: false, message: 'This booking is assigned to another driver', data: null })
    }

    // Check if any other private drivers are online/on-duty
    const otherDriversCount = await GovtDriver.countDocuments({
      _id: { $ne: driverId, $nin: existing.cancelledByDrivers || [] },
      driverType: 'PRIVATE',
      $or: [{ isOnDuty: true }, { isOnDuty: { $exists: false } }]
    }).catch(() => 1)

    const nextStatus = 'FINDING_AMBULANCE'

    const updated = await AmbulanceBooking.findByIdAndUpdate(
      bookingId,
      {
        $set: {
          status: nextStatus,
          assignedDriverId: null,
          assignedDriverType: null,
          driverLocation: null,
          cancellationReason: reason,
        },
        $addToSet: { cancelledByDrivers: driverId },
      },
      { returnDocument: 'after', runValidators: true }
    ).lean()

    const payload = publicBooking(updated)
    const io = req.app.get('io')
    if (io) {
      // Notify user & booking room
      const cancelNotice = {
        bookingId: String(updated._id),
        booking: payload,
        reason,
        message: 'Driver cancelled — searching for another nearby ambulance...',
      }
      io.to(`booking_${updated._id}`).emit('booking_driver_cancelled', cancelNotice)
      if (updated.authUserId) {
        io.to(userRoom(updated.authUserId.toString())).emit('booking_driver_cancelled', cancelNotice)
        io.to(userRoom(updated.authUserId.toString())).emit('BOOKING_STATUS_UPDATED', payload)
      }
      // Re-broadcast to private drivers channel so another driver can pick it up
      if (otherDriversCount > 0) {
        io.to('private_drivers_channel').emit('NEW_PRIVATE_BOOKING', payload)
      }
    }

    // Send FCM push to user if assigned driver cancelled
    if (isAssignedToMe && updated.authUserId) {
      User.findById(updated.authUserId).select('fcmToken fcmTokens').lean().then(userDoc => {
        const uTokens = []
        if (userDoc?.fcmToken) uTokens.push(userDoc.fcmToken)
        if (Array.isArray(userDoc?.fcmTokens)) uTokens.push(...userDoc.fcmTokens)
        const validUTokens = [...new Set(uTokens.filter(Boolean))]
        if (validUTokens.length > 0) {
          sendFcmNotification({
            tokens: validUTokens,
            title: '🔄 Re-assigning Ambulance',
            body: 'Your previous driver cancelled. Searching for another nearby ambulance...',
            channelId: 'emstrap_private_booking_buzzer_v4',
            sound: 'private_driver_alert',
            data: { bookingId: String(updated._id), type: 'BOOKING_DRIVER_CANCELLED' }
          }).catch(() => {})
        }
      }).catch(() => {})
    }

    return res.json({
      success: true,
      message: 'Ride cancelled and re-dispatched to available private drivers',
      data: { booking: payload }
    })
  } catch (error) { next(error) }
}
