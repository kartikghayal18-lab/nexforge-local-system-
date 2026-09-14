// Cloudinary access for every durable file/image upload in the app
// (project cover/gallery images, project files/documents, the business
// logo). Replaces the old local-disk-only image storage and the R2-based
// generic file storage — Cloudinary is durable in both dev and prod, so
// unlike those two there is no "not configured in production" gate here:
// missing credentials are caught once, loudly, at server startup (see
// validateCloudinaryConfigOrThrow, called from server.js the same way
// validateEncryptionKeyOrThrow is), never per-upload.
import { v2 as cloudinary } from 'cloudinary'

const REQUIRED = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']

let configured = false

function configureOnce() {
  if (configured) return
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  })
  configured = true
}

// Call this once at server startup (before accepting traffic), same
// fail-fast pattern as crypto.js's validateEncryptionKeyOrThrow — a missing
// credential must never surface later as a confusing per-upload 500.
export function validateCloudinaryConfigOrThrow() {
  const missing = REQUIRED.filter((k) => !process.env[k])
  if (missing.length) {
    throw new Error(
      `Cloudinary is not configured — missing env var(s): ${missing.join(', ')}. ` +
      'Set them from your Cloudinary dashboard (Settings → API Keys) — see docs/CLOUDINARY_SETUP.md.',
    )
  }
  configureOnce()
}

// Folder helpers — keep every upload's Cloudinary folder structure
// centralized so callers never hand-build a path string.
export const folders = {
  projectCoverGallery: (projectId) => `nexforge/projects/${projectId}/cover-gallery`,
  projectFiles: (projectId) => `nexforge/projects/${projectId}/files`,
  businessLogo: () => 'nexforge/business/logo',
}

// Safe, server-console-only diagnostic logging for every upload attempt.
// Never logs api_key/api_secret values, JWTs, or file bytes — only the
// cloud name (identifies WHICH Cloudinary account was used, without
// exposing the secret), the folder, and the resource type. On failure,
// logs the Cloudinary error's http_code + name, which is enough to tell
// "bad credentials" (401) apart from "account/plan restriction" (403)
// apart from "bad file" (400) apart from "rate limited" (420) — without
// ever repeating err.message verbatim, since some Cloudinary error
// messages can echo back request parameters.
function logUploadAttempt({ folder, resourceType }) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || '(unset)'
  console.log(`[cloudinary] upload attempt — cloud_name=${cloudName} folder=${folder} resource_type=${resourceType}`)
}

function logUploadFailure(err) {
  const httpCode = err?.http_code ?? '(none)'
  const name = err?.name ?? '(none)'
  console.error(`[cloudinary] upload failed — http_code=${httpCode} name=${name}`)
}

// uploadBuffer(buffer, { folder, resourceType, publicId, originalFilename })
//   -> { public_id, secure_url, resource_type, format, bytes, original_filename }
//
// Uses upload_stream (not a temp file path) since the whole app already
// standardizes on multer memoryStorage buffers everywhere.
export function uploadBuffer(buffer, { folder, resourceType = 'auto', publicId, originalFilename } = {}) {
  configureOnce()
  logUploadAttempt({ folder, resourceType })
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        public_id: publicId,
        use_filename: !publicId,
        unique_filename: true,
        overwrite: false,
      },
      (err, result) => {
        if (err) {
          logUploadFailure(err)
          return reject(err)
        }
        resolve({
          public_id: result.public_id,
          secure_url: result.secure_url,
          resource_type: result.resource_type,
          format: result.format,
          bytes: result.bytes,
          original_filename: originalFilename ?? result.original_filename ?? null,
        })
      },
    )
    stream.end(buffer)
  })
}

// destroyAsset(publicId, resourceType) — tolerant of "already deleted" /
// not-found responses: logs and returns, never throws, since a DB row
// should still be removable even when the remote asset is already gone.
export async function destroyAsset(publicId, resourceType = 'image') {
  if (!publicId) return
  configureOnce()
  try {
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType })
    if (result?.result && result.result !== 'ok' && result.result !== 'not found') {
      console.error('[cloudinary] destroy returned unexpected result:', publicId, result)
    }
  } catch (err) {
    console.error('[cloudinary] destroy failed (asset may already be gone):', publicId, err.message)
  }
}
