// Cloudinary implementation of the project cover/gallery image storage
// abstraction (see ./index.js for the interface contract). Bytes go to
// Cloudinary, not this Express process's local disk — durable in both dev
// and prod, no Render-persistent-disk caveat.
import { uploadBuffer, destroyAsset, folders } from '../cloudinary.js'

// saveImage({ buffer, projectId, originalName, mimeType }) -> { key, url }
// `key` is the Cloudinary public_id (stored in project_images.storage_key,
// same column the old local-disk backend used for its relative file path).
export async function saveImage({ buffer, projectId, originalName, mimeType }) {
  const result = await uploadBuffer(buffer, {
    folder: folders.projectCoverGallery(projectId),
    resourceType: 'image',
    originalFilename: originalName,
  })
  return { key: result.public_id, url: result.secure_url, resourceType: result.resource_type, format: result.format }
}

// deleteImage(key) -> void. Tolerant of "already gone" (see destroyAsset).
export async function deleteImage(key) {
  if (!key) return
  await destroyAsset(key, 'image')
}
