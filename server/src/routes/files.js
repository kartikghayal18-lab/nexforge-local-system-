import { Router } from 'express'
import multer from 'multer'
import { pool } from '../db/pool.js'
import { uploadBuffer, destroyAsset, folders } from '../lib/cloudinary.js'
import { validateFileUpload, MAX_FILE_SIZE_BYTES } from '../lib/storage/fileValidation.js'

const router = Router()

// Memory storage: we validate (MIME + magic bytes + size) and hand the
// buffer to Cloudinary ourselves, same discipline as project images.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_SIZE_BYTES } })

async function projectExists(projectId) {
  const { rows } = await pool.query('SELECT id FROM projects WHERE id = $1', [projectId])
  return rows.length > 0
}

router.get('/project/:projectId', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM project_files WHERE project_id = $1 ORDER BY created_at DESC', [req.params.projectId])
  res.json(rows)
})

// POST /project/:projectId — multipart/form-data, field name "file".
// Uploads directly to Cloudinary (no presign step — a small backend-side
// buffer upload, unlike the old R2 flow) and records metadata. Cloudinary's
// secure_url returned here is itself the durable, permanent URL — no
// re-signing needed to view/download later.
router.post('/project/:projectId', upload.single('file'), async (req, res) => {
  const { projectId } = req.params
  if (!(await projectExists(projectId))) return res.status(404).json({ error: 'Project not found' })
  if (!req.file) return res.status(400).json({ error: 'No file provided (field name must be "file")' })

  const { buffer, originalname, mimetype, size } = req.file
  const validation = validateFileUpload({ buffer, mimeType: mimetype, originalName: originalname, size })
  if (!validation.ok) return res.status(400).json({ error: validation.error })

  // Cloudinary treats non-image files as 'raw' resources; images upload as
  // 'image' so its own transformation/CDN pipeline applies to them too.
  const resourceType = mimetype.startsWith('image/') ? 'image' : 'raw'
  const result = await uploadBuffer(buffer, {
    folder: folders.projectFiles(projectId),
    resourceType,
    originalFilename: originalname,
  })

  const { rows } = await pool.query(
    `INSERT INTO project_files (project_id, file_name, file_type, file_size, storage_key, url, category, resource_type, format)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [projectId, originalname, mimetype, size, result.public_id, result.secure_url, req.body?.category ?? null, result.resource_type, result.format ?? null],
  )
  res.json(rows[0])
})

router.delete('/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT storage_key, resource_type FROM project_files WHERE id = $1', [req.params.id])
  if (rows.length) {
    // Cloudinary delete, then the DB row — in that order, so a failed
    // Cloudinary delete never orphans an already-removed DB row; but a
    // failed Cloudinary delete (logged, not thrown — see destroyAsset) must
    // not block removing the DB row either, since the user asked to delete
    // the file and the UI outcome ("it's gone from the list") should be
    // predictable regardless of a transient Cloudinary error.
    await destroyAsset(rows[0].storage_key, rows[0].resource_type || 'raw')
  }
  await pool.query('DELETE FROM project_files WHERE id = $1', [req.params.id])
  res.json({ ok: true })
})

export default router
