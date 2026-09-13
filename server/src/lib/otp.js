// Pure helpers for the email-OTP login flow (server/src/routes/auth.js).
// Kept separate from the route so the generation/hashing/rate-limit logic
// can be unit-tested directly (see server/scripts/smoke-test.js) without a
// running server or a real Resend account.
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'

export const OTP_EXPIRY_MS = 10 * 60 * 1000 // 10 minutes
export const RESEND_COOLDOWN_MS = 60 * 1000 // 60 seconds between sends
export const MAX_SENDS_PER_HOUR = 5
export const MAX_VERIFY_ATTEMPTS = 5 // guards against brute-forcing a 6-digit code

// 6-digit code, cryptographically secure (never Math.random()).
export function generateOtpCode() {
  return String(crypto.randomInt(100000, 1000000))
}

export function hashOtpCode(code) {
  return bcrypt.hash(code, 10)
}

export function compareOtpCode(code, hash) {
  return bcrypt.compare(code, hash)
}

// Pure rate-limit check over this email's recent otp_codes.created_at
// timestamps (already fetched by the caller) — no DB access here, so it's
// testable with plain arrays of Date objects.
// Returns { allowed: true } or { allowed: false, error, waitSeconds? }.
export function checkSendRateLimit(recentCreatedAts, now = new Date()) {
  const nowMs = now.getTime()
  const sorted = [...recentCreatedAts].map((d) => new Date(d).getTime()).sort((a, b) => b - a)

  if (sorted.length) {
    const elapsedSinceLast = nowMs - sorted[0]
    if (elapsedSinceLast < RESEND_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((RESEND_COOLDOWN_MS - elapsedSinceLast) / 1000)
      return { allowed: false, error: `Please wait ${waitSeconds}s before requesting another code`, waitSeconds }
    }
  }

  const oneHourAgoMs = nowMs - 60 * 60 * 1000
  const withinLastHour = sorted.filter((t) => t >= oneHourAgoMs)
  if (withinLastHour.length >= MAX_SENDS_PER_HOUR) {
    return { allowed: false, error: 'Too many requests, try again later' }
  }

  return { allowed: true }
}
