// Storage abstraction for project images.
//
// WHY THIS FILE EXISTS: routes and the DB schema must never know *how* or
// *where* image bytes are actually stored. Today `localDisk.js` writes them
// to this Express process's own local disk (server/public/images/projects/)
// and they are served back out via `express.static` (see server/src/app.js).
// That is NOT the Vite frontend's `public/` folder and it does NOT touch
// Vercel's filesystem — Vercel's runtime FS is ephemeral/read-only per
// request, so any upload handled by Vercel-hosted code would silently
// vanish. This backend runs on Render instead, which can have a real disk —
// see docs/DEPLOYMENT.md for the important caveat about Render's disk only
// being persistent across redeploys if you attach the paid Persistent Disk
// add-on.
//
// TO SWAP TO S3 / CLOUDFLARE R2 LATER: this project already has an R2
// client for generic project files (see server/src/lib/r2.js) — reusing
// that pattern here is the natural next step and removes the Render-disk
// caveat entirely. Write `server/src/lib/storage/s3.js` exporting the same
// three functions below with the same signatures, then change ONE import
// line (just below) to point at it, and set STORAGE_BACKEND=s3 (or r2) in
// the environment so the production gate below (STORAGE_NOT_CONFIGURED)
// stops applying. No route code, no DB schema, and no frontend code needs
// to change — every caller only ever imports from this file, never from a
// concrete implementation.
import { saveImage as saveImageLocalDisk, deleteImage } from './localDisk.js'
export { deleteImage }

// Which storage implementation is actually wired up. 'local-dev' (the
// default when unset) means "just the local disk" — fine for development,
// but NOT durable in production (Render's disk is ephemeral without a paid
// Persistent Disk add-on — see docs/DEPLOYMENT.md). Set to 's3' or 'r2'
// once server/src/lib/storage/s3.js exists and is wired up above.
export const STORAGE_BACKEND = process.env.STORAGE_BACKEND || 'local-dev'

// Thrown by saveImage() when we're running in production and nobody has
// configured real persistent storage yet. Named so routes can distinguish
// it from any other failure and map it to a 503, not a generic 500.
export class StorageNotConfiguredError extends Error {
  constructor(message) {
    super(message)
    this.name = 'StorageNotConfiguredError'
  }
}

const STORAGE_NOT_CONFIGURED_MESSAGE =
  'Persistent image storage is not configured yet. Uploads are disabled in production until Cloudflare R2 (or S3) is set up — see docs/DEPLOYMENT.md.'

// saveImage({ buffer, projectId, originalName, mimeType }) -> { key, url }
//
// This gate lives here (the abstraction layer), not inside localDisk.js
// itself, so localDisk.js stays a simple, honest "write bytes to disk"
// implementation — the "is this actually safe to rely on in production?"
// policy decision belongs to whichever implementation is currently
// selected, i.e. here.
export async function saveImage(args) {
  if (process.env.NODE_ENV === 'production' && STORAGE_BACKEND === 'local-dev') {
    throw new StorageNotConfiguredError(STORAGE_NOT_CONFIGURED_MESSAGE)
  }
  return saveImageLocalDisk(args)
}

// Shared validation constants/helpers, implementation-agnostic so both the
// local-disk and any future remote backend enforce the exact same rules.
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
