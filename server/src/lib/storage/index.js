// Storage abstraction for project cover/gallery images.
//
// WHY THIS FILE EXISTS: routes and the DB schema must never know *how* or
// *where* image bytes are actually stored — only this file's exported
// functions. The concrete implementation is Cloudinary (./cloudinary.js),
// which is durable in both development and production, so unlike the old
// local-disk implementation there is no "not configured in production"
// gate here anymore: a missing Cloudinary credential is caught once,
// loudly, at server startup (see server/src/lib/cloudinary.js +
// server/src/server.js), never per-upload.
//
// TO SWAP BACKENDS LATER: write a new implementation file exporting the
// same two functions with the same signatures below, then change the one
// import line just below. No route code, no DB schema, and no frontend
// code needs to change — every caller only ever imports from this file,
// never from a concrete implementation.
export { saveImage, deleteImage } from './cloudinary.js'

// Shared validation constants/helpers, implementation-agnostic so any
// future backend enforces the exact same rules.
export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']
export const MAX_IMAGE_SIZE_BYTES = (Number(process.env.IMAGE_MAX_SIZE_MB) || 5) * 1024 * 1024

const MIME_TO_EXT = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
}

// Magic-byte sniffing so we don't trust the client-supplied MIME type or a
// spoofed file extension alone. Checks the first few bytes of the buffer
// against the known signatures for JPEG/PNG/WebP.
function detectMimeFromMagicBytes(buffer) {
  if (!buffer || buffer.length < 12) return null
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg'
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'image/png'
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return 'image/webp'
  }
  return null
}

// Pure validation function (no I/O) so it can be unit-tested directly
// without a running server — see server/scripts/smoke-test.js.
// Returns { ok: true } or { ok: false, error: string }.
export function validateImageUpload({ buffer, mimeType, originalName, size }) {
  const declaredSize = typeof size === 'number' ? size : buffer?.length ?? 0
  if (declaredSize > MAX_IMAGE_SIZE_BYTES) {
    return { ok: false, error: `Image is too large (max ${MAX_IMAGE_SIZE_BYTES / (1024 * 1024)}MB)` }
  }
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return { ok: false, error: 'Only JPG, PNG and WebP images are allowed' }
  }
  const ext = ('.' + (originalName?.split('.').pop() || '')).toLowerCase()
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return { ok: false, error: 'File extension does not match an allowed image type' }
  }
  const expectedExts = MIME_TO_EXT[mimeType] || []
  if (!expectedExts.includes(ext)) {
    return { ok: false, error: 'File extension does not match its declared type' }
  }
  const sniffed = detectMimeFromMagicBytes(buffer)
  if (!sniffed) {
    return { ok: false, error: 'File content is not a recognizable JPG, PNG or WebP image' }
  }
  if (sniffed !== mimeType) {
    return { ok: false, error: 'File content does not match its declared type' }
  }
  return { ok: true }
}
