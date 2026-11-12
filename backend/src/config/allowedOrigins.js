const configuredOrigins = (process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean)

export function isAllowedOrigin(origin) {
  if (!origin) return true
  if (configuredOrigins.includes(origin)) return true

  try {
    const url = new URL(origin)
    const hostname = url.hostname
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true
    if (hostname.startsWith('10.') || hostname.startsWith('192.168.')) return true
    if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)) return true
  } catch {
    return configuredOrigins.includes(origin)
  }

  return false
}

export const corsOriginDelegate = (origin, callback) => {
  callback(null, isAllowedOrigin(origin))
}

export const allowedOrigins = {
  includes: (origin) => isAllowedOrigin(origin),
}
