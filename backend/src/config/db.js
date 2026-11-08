import mongoose from 'mongoose'

const connectionOptions = {
  // Assumes a traditional long-running API server with short OLTP operations.
  maxPoolSize: 20,
  minPoolSize: 2,
  maxIdleTimeMS: 300000,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 30000,
  serverSelectionTimeoutMS: 5000,
  bufferCommands: false,
}

const emergencyUri = process.env.EMERGENCY_MONGODB_URI
const bookingUri = process.env.BOOKING_MONGODB_URI

export const emergencyDb = mongoose.createConnection(emergencyUri || 'mongodb://127.0.0.1:27017/EMSTRAP-Emergency', connectionOptions)
export const bookingDb = mongoose.createConnection(bookingUri || 'mongodb://127.0.0.1:27017/EMSTRAP-Booking', connectionOptions)

function logConnection(connection, name) {
  connection.on('connected', () => console.log(`[db] ${name} connected`))
  connection.on('error', error => console.error(`[db] ${name} error:`, error.message))
  connection.on('disconnected', () => console.warn(`[db] ${name} disconnected`))
}

logConnection(emergencyDb, 'EMSTRAP-Emergency')
logConnection(bookingDb, 'EMSTRAP-Booking')

export async function connectDatabases() {
  await Promise.all([emergencyDb.asPromise(), bookingDb.asPromise()])
  return { emergencyDb, bookingDb }
}

export async function disconnectDatabases() {
  await Promise.all([emergencyDb.close(), bookingDb.close()])
}

const locationSchema = new mongoose.Schema({
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  address: String,
  source: String,
  heading: Number,
  updatedAt: { type: Date, default: Date.now },
}, { _id: false })

const mediaSchema = new mongoose.Schema({
  url: String,
  publicId: String,
  originalName: String,
  mimeType: String,
}, { _id: false })

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  phone: String,
  role: { type: String, enum: ['USER', 'GOVT_DRIVER', 'POLICE', 'HOSPITAL', 'ADMIN'], default: 'USER' },
  sessionVersion: { type: Number, default: 0, select: false },
  passwordHash: { type: String, required: true, select: false },
  isEmailVerified: { type: Boolean, default: false },
  verificationCodeHash: { type: String, select: false },
  verificationCodeExpiresAt: { type: Date, select: false },
  verificationAttempts: { type: Number, default: 0, select: false },
  currentLocation: locationSchema,
}, { timestamps: true })
const basicRoleSchema = new mongoose.Schema({ name: String, email: String, phone: String, role: String, stationName: String, location: locationSchema }, { timestamps: true })
const govtDriverSchema = new mongoose.Schema({ name: { type: String, required: true, trim: true }, email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true }, phone: String, driverType: { type: String, enum: ['GOVERNMENT', 'PRIVATE'], default: 'GOVERNMENT' }, governmentId: { type: String, trim: true }, role: { type: String, default: 'GOVT_DRIVER' }, sessionVersion: { type: Number, default: 0, select: false }, passwordHash: { type: String, required: true, select: false }, isEmailVerified: { type: Boolean, default: false }, verificationCodeHash: { type: String, select: false }, verificationCodeExpiresAt: { type: Date, select: false }, verificationAttempts: { type: Number, default: 0, select: false }, status: { type: String, enum: ['PENDING_DOCUMENTS', 'PENDING_REVIEW', 'ACTIVE', 'SUSPENDED'], default: 'PENDING_DOCUMENTS' }, selfie: mediaSchema, drivingLicense: mediaSchema, currentLocation: locationSchema }, { timestamps: true })
const emergencyRequestSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  anonymous: { type: Boolean, default: false },
  status: { type: String, enum: ['PENDING', 'ACCEPTED', 'ARRIVED', 'ASSIGNED_HOSPITAL', 'COMPLETED', 'CANCELLED'], default: 'PENDING', index: true },
  location: { type: locationSchema, required: true },
  driverLocation: locationSchema,
  incidentImage: mediaSchema,
  evidence: [mediaSchema],
  assignedDriverId: { type: mongoose.Schema.Types.ObjectId, ref: 'GovtDriver' },
  incidentDetails: String,
}, { timestamps: true })
const emergencyAlertSchema = new mongoose.Schema({ emergencyRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmergencyRequest', required: true }, type: String, recipients: [String], deliveredAt: Date }, { timestamps: true })

const bookingUserSchema = new mongoose.Schema({ name: String, email: String, phone: String }, { timestamps: true })
const privateDriverSchema = new mongoose.Schema({ name: String, phone: String, isOnline: Boolean, currentLocation: locationSchema }, { timestamps: true })
const ambulanceBookingSchema = new mongoose.Schema({ userId: { type: mongoose.Schema.Types.ObjectId, ref: 'BookingUser' }, tier: { type: String, enum: ['STANDARD', 'PREGNANCY', 'ICU', 'SPECIAL'] }, status: { type: String, enum: ['PENDING', 'ACCEPT', 'START_TRIP', 'COMPLETE_TRIP'], default: 'PENDING' }, pickup: String, destination: String, scheduledFor: Date, driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'PrivateDriver' }, price: Number, paymentStatus: { type: String, enum: ['PENDING', 'PAID', 'REFUNDED'], default: 'PENDING' } }, { timestamps: true })

export const User = emergencyDb.model('User', userSchema)
export const Admin = emergencyDb.model('Admin', basicRoleSchema)
export const Hospital = emergencyDb.model('Hospital', basicRoleSchema)
export const Police = emergencyDb.model('Police', basicRoleSchema)
export const GovtDriver = emergencyDb.model('GovtDriver', govtDriverSchema)
export const EmergencyRequest = emergencyDb.model('EmergencyRequest', emergencyRequestSchema)
export const EmergencyAlert = emergencyDb.model('EmergencyAlert', emergencyAlertSchema)

export const BookingUser = bookingDb.model('BookingUser', bookingUserSchema)
export const PrivateDriver = bookingDb.model('PrivateDriver', privateDriverSchema)
export const AmbulanceBooking = bookingDb.model('AmbulanceBooking', ambulanceBookingSchema)
