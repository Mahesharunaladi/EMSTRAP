import { v2 as cloudinary } from 'cloudinary'

const configured = Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
if (configured) cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET, secure: true })

export function uploadImage(data, folder = 'emstrap/incidents') {
  if (!configured || !data) return Promise.resolve(null)
  return new Promise((resolve, reject) => cloudinary.uploader.upload(data, { folder, resource_type: 'image' }, (error, result) => error ? reject(error) : resolve({ url: result.secure_url, publicId: result.public_id })))
}

export { configured as cloudinaryConfigured }
