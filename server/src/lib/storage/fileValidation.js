// Validation for generic project files/documents (contracts, requirement
// docs, spreadsheets, archives, images) uploaded via server/src/routes/files.js.
// Deliberately separate from validateImageUpload in ./index.js — files have
// a much broader allowed-type set and different size limits, so conflating
// the two would either loosen image rules or make document uploads absurdly
// strict.
export const MAX_FILE_SIZE_BYTES = (Number(process.env.FILE_MAX_SIZE_MB) || 20) * 1024 * 1024

// mimeType -> allowed extensions. Office formats (docx/xlsx) are
// zip-based, so their magic bytes are the plain ZIP signature — we can't
// distinguish "this zip is actually a docx" from magic bytes alone without
// a much heavier parser, so those two rely on extension/MIME agreement
// only, same as the app's own comments about this tradeoff mention.
const MIME_TO_EXT = {
  'application/pdf': ['.pdf'],
  'application/zip': ['.zip'],
  'application/x-zip-compressed': ['.zip'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'text/plain': ['.txt'],
  'text/csv': ['.csv'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
}

export const ALLOWED_FILE_MIME_TYPES = Object.keys(MIME_TO_EXT)

// Magic-byte sniffing for the formats that have a reliable, distinct
// signature. Anything not covered here (plain text/CSV, and the
// office/zip-based formats above) is skipped — extension + declared MIME
// agreement is the best available check for those.
function sniffKnownSignature(buffer) {
  if (!buffer || buffer.length < 4) return null
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) return 'pdf' // %PDF
  if (buffer[0] === 0x50 && buffer[1] === 0x4b && (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07)) return 'zip' // PK.. — zip, docx, xlsx all share this
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg'
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'png'
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer.length >= 12 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return 'webp'
  }
  return null
}

const ZIP_BASED_MIMES = new Set([
  'application/zip',
  'application/x-zip-compressed',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])

// Pure validation function (no I/O), mirroring validateImageUpload's shape
// so it's testable directly. Returns { ok: true } or { ok: false, error }.
export function validateFileUpload({ buffer, mimeType, originalName, size }) {
  const declaredSize = typeof size === 'number' ? size : buffer?.length ?? 0
  if (declaredSize > MAX_FILE_SIZE_BYTES) {
    return { ok: false, error: `File is too large (max ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB)` }
  }
  if (!ALLOWED_FILE_MIME_TYPES.includes(mimeType)) {
    return { ok: false, error: 'This file type is not allowed' }
  }
  const ext = ('.' + (originalName?.split('.').pop() || '')).toLowerCase()
  const expectedExts = MIME_TO_EXT[mimeType] || []
  if (!expectedExts.includes(ext)) {
    return { ok: false, error: 'File extension does not match its declared type' }
  }
  const sniffed = sniffKnownSignature(buffer)
  if (mimeType === 'application/pdf') {
    if (sniffed !== 'pdf') return { ok: false, error: 'File content is not a valid PDF' }
  } else if (ZIP_BASED_MIMES.has(mimeType)) {
    if (sniffed !== 'zip') return { ok: false, error: 'File content is not a valid archive/office document' }
  } else if (mimeType === 'image/jpeg') {
    if (sniffed !== 'jpeg') return { ok: false, error: 'File content is not a valid JPEG' }
  } else if (mimeType === 'image/png') {
    if (sniffed !== 'png') return { ok: false, error: 'File content is not a valid PNG' }
  } else if (mimeType === 'image/webp') {
    if (sniffed !== 'webp') return { ok: false, error: 'File content is not a valid WebP' }
  }
  // text/plain and text/csv have no reliable magic bytes — extension/MIME
  // agreement above is the check for those.
  return { ok: true }
}
