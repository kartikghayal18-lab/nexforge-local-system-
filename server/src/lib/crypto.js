// AES-256-GCM authenticated encryption for vault fields (secrets, passwords,
// database credentials). Keyed by a single server-side ENCRYPTION_KEY env var
// (32 random bytes, base64) — see docs/VAULT_SECURITY.md for why this design
// (no per-request "master password unlock" like the old desktop app) is a
// deliberate simplification, not an oversight.
import crypto from 'node:crypto'

const ALGO = 'aes-256-gcm'

function getKey() {
  const b64 = process.env.ENCRYPTION_KEY
  if (!b64) throw new Error('ENCRYPTION_KEY is not set')
  const key = Buffer.from(b64, 'base64')
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must decode to exactly 32 bytes (base64 of 32 random bytes)')
  }
  return key
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

export function mask() {
  return '••••••••'
}
