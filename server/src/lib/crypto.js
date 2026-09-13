// AES-256-GCM authenticated encryption for vault fields (secrets, passwords,
// database credentials). Keyed by a single server-side ENCRYPTION_KEY env var
// (32 random bytes, base64) — see docs/VAULT_SECURITY.md for why this design
// (no per-request "master password unlock" like the old desktop app) is a
// deliberate simplification, not an oversight.
//
// The key is validated ONCE (cached after the first successful read) so a
// bad/missing key fails fast and loudly instead of silently generating a new
// one, which would permanently orphan every previously-encrypted row.
import crypto from 'node:crypto'

const ALGO = 'aes-256-gcm'

let cachedKey = null

function readAndValidateKey() {
  const b64 = process.env.ENCRYPTION_KEY
  if (!b64) {
    throw new Error('ENCRYPTION_KEY is not set. Set it to a base64-encoded 32-byte key (e.g. `openssl rand -base64 32`).')
  }
  let key
  try {
    key = Buffer.from(b64, 'base64')
  } catch {
    throw new Error('ENCRYPTION_KEY is not valid base64.')
  }
  if (key.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY must decode to exactly 32 bytes, got ${key.length} bytes. ` +
      'Generate a valid one with `openssl rand -base64 32` and set it as ENCRYPTION_KEY.',
    )
  }
  return key
}

function getKey() {
  if (cachedKey) return cachedKey
  cachedKey = readAndValidateKey()
  return cachedKey
}

// Call this once at server startup (before accepting traffic) so a bad key
// fails the boot with a clear message instead of surfacing later as a
// confusing per-request 500 on the first encrypt/decrypt call.
export function validateEncryptionKeyOrThrow() {
  getKey()
}

// Returns a single opaque string: base64(iv).base64(authTag).base64(ciphertext)
export function encrypt(plaintext) {
  const key = getKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join('.')
}

export function decrypt(payload) {
  if (!payload) return null
  const key = getKey()
  const [ivB64, tagB64, dataB64] = payload.split('.')
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('malformed ciphertext payload')
  const iv = Buffer.from(ivB64, 'base64')
  const authTag = Buffer.from(tagB64, 'base64')
  const data = Buffer.from(dataB64, 'base64')
  const decipher = crypto.createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(authTag)
  const plaintext = Buffer.concat([decipher.update(data), decipher.final()])
  return plaintext.toString('utf8')
}

// Use at single-record "reveal" endpoints: turns a corrupt/mismatched
// ciphertext (e.g. ENCRYPTION_KEY was rotated after this row was written)
// into a clean, safe result instead of throwing an unhandled exception that
// would otherwise 500 with a stack trace via the generic error handler.
// Returns { ok: true, value } or { ok: false }.
export function safeDecrypt(payload) {
  try {
    return { ok: true, value: decrypt(payload) }
  } catch (err) {
    console.error('[crypto] decrypt failed (corrupt ciphertext or wrong ENCRYPTION_KEY):', err.message)
    return { ok: false }
  }
}

export function mask() {
  return '••••••••'
}
