import { AmbulanceBooking, BookingUser, GovtDriver } from '../config/db.js'
import { canDriverReceiveDispatch } from '../utils/driverDispatch.js'

const activeBookingStatuses = ['ACCEPTED', 'STARTED']
const tierRates = { STANDARD: 150, PREGNANCY: 250, ICU: 300, SPECIAL: 200 }
const driverRooms = ['govt_drivers_channel', 'private_drivers_channel']
const userRoom = id => `user:${id}`

function validLocation(value) {
  const lat = Number(value?.lat); const lng = Number(value?.lng)
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
    ? { lat, lng, source: value.source === 'browser-gps' ? 'browser-gps' : 'user-selected' }
    : null
}

function publicBooking(booking) {
  return {
    _id: booking._id, tier: booking.tier, status: booking.status,
    pickup: booking.pickup, pickupLocation: booking.pickupLocation,
    destination: booking.destination, destinationLocation: booking.destinationLocation,
    driverLocation: booking.driverLocation, assignedDriverId: booking.assignedDriverId,
    assignedDriverType: booking.assignedDriverType, createdAt: booking.createdAt,
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
    if (!Object.hasOwn(tierRates, tier) || !pickup || pickup.length > 500 || !destination || destination.length > 500 || !pickupLocation || !destinationLocation) {
      return res.status(400).json({ success: false, message: 'Choose a service and provide pickup and drop-off addresses with valid map locations', data: null })
    }
    const bookingUser = await BookingUser.findOneAndUpdate(
      { email: req.user.email },
      { $set: { name: req.user.name, email: req.user.email, phone: req.user.phone || '' } },
      { upsert: true, returnDocument: 'after', runValidators: true },
    )
    const booking = await AmbulanceBooking.create({
      userId: bookingUser._id, authUserId: req.user._id,
      customerName: req.user.name, customerPhone: req.user.phone || '',
      tier, status: 'PENDING', pickup, pickupLocation, destination, destinationLocation,
      price: tierRates[tier],
    })
    const payload = publicBooking(booking)
    const io = req.app.get('io')
    if (io) io.to(driverRooms[0]).to(driverRooms[1]).emit('NEW_PRIVATE_BOOKING', payload)
    res.status(201).json({ success: true, message: 'Ambulance request sent to available drivers', data: { booking: payload } })
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
    if (!canDriverReceiveDispatch(req.driver)) {
      return res.json({
        success: true,
        message: 'Driver approval is required before receiving bookings',
        data: { bookings: [], driverStatus: req.driver.status, canReceiveBookings: false },
      })
    }
    const bookings = await AmbulanceBooking.find({
      $or: [
        // `null` matches both legacy missing values and explicit null values.
        { status: 'PENDING', assignedDriverId: null },
        { status: { $in: activeBookingStatuses }, assignedDriverId: req.driver._id },
      ],
    }).sort({ createdAt: -1 }).limit(50).lean()
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
    if (!canDriverReceiveDispatch(driver)) return res.status(403).json({ success: false, message: 'Driver approval or document verification is required before accepting bookings', data: null })
    const booking = await AmbulanceBooking.findOneAndUpdate(
      // Atomic conditional claim: only one concurrent driver can change this row.
      { _id: req.params.bookingId, status: 'PENDING', assignedDriverId: null },
      { $set: { status: 'ACCEPTED', assignedDriverId: driver._id, assignedDriverType: driver.driverType || 'GOVERNMENT' } },
      { returnDocument: 'after', runValidators: true },
    ).lean()
    if (!booking) return res.status(409).json({ success: false, message: 'This booking was already accepted or is no longer available', data: null })
    const io = req.app.get('io')
    const assignment = { booking: publicBooking(booking), driver: { id: driver._id, name: driver.name, phone: driver.phone, driverType: driver.driverType } }
    if (io) {
      // Other drivers need only the claim ID so their dashboards immediately remove it.
      io.to(driverRooms[0]).to(driverRooms[1]).emit('BOOKING_ASSIGNED', { booking: publicBooking(booking), driver: { id: driver._id } })
      if (booking.authUserId) io.to(userRoom(booking.authUserId.toString())).emit('BOOKING_DRIVER_ASSIGNED', assignment)
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
    if (io && booking.authUserId) io.to(userRoom(booking.authUserId.toString())).emit('BOOKING_STATUS_UPDATED', payload)
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
