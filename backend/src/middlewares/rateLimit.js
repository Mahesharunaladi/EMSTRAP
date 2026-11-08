const windows = new Map()

export function rateLimit({ windowMs = 15 * 60 * 1000, max = 10 } = {}) {
  return (req, res, next) => {
    const now = Date.now()
    const key = `${req.ip}:${req.baseUrl}${req.path}`
    let entry = windows.get(key)
    if (!entry || entry.resetAt <= now) entry = { count: 0, resetAt: now + windowMs }
    entry.count += 1
    windows.set(key, entry)
    if (windows.size > 10000) for (const [storedKey, value] of windows) if (value.resetAt <= now) windows.delete(storedKey)
    res.set('RateLimit-Limit', String(max))
    res.set('RateLimit-Remaining', String(Math.max(0, max - entry.count)))
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)))
      return res.status(429).json({ success: false, message: 'Too many requests. Please try again later.', data: null })
    }
    next()
  }
}
