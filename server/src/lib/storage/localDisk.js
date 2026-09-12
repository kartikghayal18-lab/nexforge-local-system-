// Local-disk implementation of the storage abstraction (see ./index.js for
// the interface contract and why this exists). Writes go under this
// Express process's own `server/public/images/projects/<projectId>/`
// directory and are served back out by `express.static` in app.js — this
// is NOT the Vite frontend's `public/` folder, and it never runs on
// Vercel. See docs/DEPLOYMENT.md for the Render-persistent-disk caveat.
import { promises as fs } from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const PUBLIC_DIR = path.join(process.cwd(), 'public', 'images', 'projects')

// Strips path separators and anything but a conservative character set,
// then prefixes with a UUID so two uploads can never collide or overwrite
// each other — same discipline as any file-upload code taking user input.
function sanitizeFileName(originalName) {
  const base = path.basename(originalName || 'image')
  const safe = base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100)
  return `${crypto.randomUUID()}-${safe || 'image'}`
}

// saveImage({ buffer, projectId, originalName, mimeType }) -> { key, url }
export async function saveImage({ buffer, projectId, originalName }) {
  const dir = path.join(PUBLIC_DIR, projectId)
  await fs.mkdir(dir, { recursive: true })
  const fileName = sanitizeFileName(originalName)
  const filePath = path.join(dir, fileName)
  await fs.writeFile(filePath, buffer)

  const key = `projects/${projectId}/${fileName}`
  const url = `/images/${key}`
  return { key, url }
}

// deleteImage(key) -> void. Ignores "already gone" so deleting a DB row
// whose file was already removed by hand doesn't throw.
export async function deleteImage(key) {
  if (!key) return
  // key looks like "projects/<projectId>/<fileName>"; PUBLIC_DIR already
  // ends in .../images/projects, so strip that leading segment.
  const relative = key.replace(/^projects\//, '')
  const filePath = path.join(PUBLIC_DIR, ...relative.split('/'))
  // Guard against path traversal even though sanitizeFileName never
  // produces ".." segments — belt and suspenders for a delete-by-string-key API.
  if (!filePath.startsWith(PUBLIC_DIR)) throw new Error('Invalid storage key')
  try {
    await fs.unlink(filePath)
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }
}
