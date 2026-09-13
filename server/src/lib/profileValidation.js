// Pure validation for the owner profile (server/src/routes/profile.js).
// Kept separate from the route so it's unit-testable directly (see
// server/scripts/smoke-test.js) without a running server.
export const REQUIRED_PROFILE_FIELDS = ['full_name', 'business_name', 'phone', 'avatar_url', 'address', 'currency', 'timezone']
export const OPTIONAL_PROFILE_FIELDS = ['website', 'gstin']
export const ALL_PROFILE_FIELDS = [...REQUIRED_PROFILE_FIELDS, ...OPTIONAL_PROFILE_FIELDS]

// Small fixed list rather than every ISO 4217 code — this is a personal
// studio-management tool, not a multi-currency accounting system. Extend
// this list if the owner needs a currency it doesn't cover.
export const ALLOWED_CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'AED']

const PHONE_RE = /^[+\d][\d\s\-()]{6,19}$/
const WEBSITE_RE = /^(https?:\/\/)[^\s"'<>]+\.[^\s"'<>]+$/i

function isValidTimezone(tz) {
  // Intl.DateTimeFormat accepts any valid IANA zone name, including legacy
  // aliases (e.g. "Asia/Kolkata", an alias for the ICU-canonical
  // "Asia/Calcutta") that Intl.supportedValuesOf('timeZone') does NOT list —
  // so this is the real acceptance check. supportedValuesOf is used only as
  // a stricter fallback on runtimes old enough to lack it (Node/browser
  // support here is broad, but this keeps the function from ever throwing).
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz })
    return true
  } catch {
    // fall through
  }
  try {
    if (typeof Intl.supportedValuesOf === 'function') {
      return Intl.supportedValuesOf('timeZone').includes(tz)
    }
  } catch {
    // ignore
  }
  return false
}

// Validates a partial or full profile update. `input` is the raw request
// body; `existing` is the current DB row (used to know which required
// fields are already satisfied when this update only touches some of them).
// Returns { ok: true, errors: {} } or { ok: false, errors: { field: msg } }.
export function validateProfileUpdate(input, existing = {}) {
  const errors = {}
  const merged = { ...existing, ...input }

  for (const field of REQUIRED_PROFILE_FIELDS) {
    if (field in input) {
      const v = input[field]
      if (typeof v !== 'string' || !v.trim()) {
        errors[field] = `${field} is required`
      }
    }
  }

  if (merged.phone && !PHONE_RE.test(String(merged.phone).trim())) {
    errors.phone = 'Enter a valid phone number'
  }
  if (merged.website && !WEBSITE_RE.test(String(merged.website).trim())) {
    errors.website = 'Website must be a valid http(s) URL'
  }
  if (merged.currency && !ALLOWED_CURRENCIES.includes(String(merged.currency).trim())) {
    errors.currency = `Currency must be one of: ${ALLOWED_CURRENCIES.join(', ')}`
  }
  if (merged.timezone && !isValidTimezone(String(merged.timezone).trim())) {
    errors.timezone = 'Timezone must be a valid IANA timezone (e.g. Asia/Kolkata)'
  }

  return { ok: Object.keys(errors).length === 0, errors }
}

// True once every required field is a non-empty string on the merged record.
export function isProfileComplete(record) {
  return REQUIRED_PROFILE_FIELDS.every((f) => typeof record[f] === 'string' && record[f].trim().length > 0)
}
