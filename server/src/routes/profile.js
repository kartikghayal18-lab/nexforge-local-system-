import { Router } from 'express'
import multer from 'multer'
import { pool } from '../db/pool.js'
import { saveImage, validateImageUpload, MAX_IMAGE_SIZE_BYTES } from '../lib/storage/index.js'
import { validateProfileUpdate, isProfileComplete, ALL_PROFILE_FIELDS } from '../lib/profileValidation.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_IMAGE_SIZE_BYTES } })

const PUBLIC_COLUMNS = 'id, email, full_name, business_name, phone, avatar_url, address, website, gstin, currency, timezone, profile_completed_at, created_at'

router.get('/', async (req, res) => {
  const { rows } = await pool.query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`, [req.userId])
  if (!rows.length) return res.status(404).json({ error: 'not found' })
  res.json(rows[0])
})

router.put('/', async (req, res) => {
  const { rows: existingRows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.userId])
  if (!existingRows.length) return res.status(404).json({ error: 'not found' })
  const existing = existingRows[0]

  const input = {}
  for (const field of ALL_PROFILE_FIELDS) {
    if (field in (req.body || {})) input[field] = req.body[field]
  }

  const validation = validateProfileUpdate(input, existing)
  if (!validation.ok) return res.status(400).json({ error: 'Invalid profile data', fields: validation.errors })

  const merged = { ...existing, ...input }
  const nowComplete = isProfileComplete(merged)
  const completedAt = nowComplete ? existing.profile_completed_at || new Date() : existing.profile_completed_at

  const setCols = [...ALL_PROFILE_FIELDS, 'profile_completed_at']
  const setClause = setCols.map((c, i) => `${c} = $${i + 1}`).join(', ')
  const values = [...ALL_PROFILE_FIELDS.map((f) => merged[f] ?? null), completedAt, req.userId]

  const { rows } = await pool.query(
    `UPDATE users SET ${setClause} WHERE id = $${values.length} RETURNING ${PUBLIC_COLUMNS}`,
    values,
  )
  res.json(rows[0])
})

// Avatar upload — reuses the exact same storage abstraction as project
// images (server/src/lib/storage/), including the same production
// STORAGE_BACKEND gate. A profile avatar is just another image; there's no
// separate upload mechanism for it. Files are grouped under a
// "profile-<userId>" pseudo-project directory purely for on-disk tidiness.
router.post('/avatar', upload.single('avatar'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image file provided (field name must be "avatar")' })
  const { buffer, originalname, mimetype, size } = req.file
  const validation = validateImageUpload({ buffer, mimeType: mimetype, originalName: originalname, size })
  if (!validation.ok) return res.status(400).json({ error: validation.error })

  const { url } = await saveImage({ buffer, projectId: `profile-${req.userId}`, originalName: originalname, mimeType: mimetype })
  res.json({ url })
})

// Records an avatar that's already a static asset (e.g. committed under the
// Vite frontend's public/, including the shipped placeholder avatar) or any
// other absolute URL, without uploading bytes — same pattern as project
// images' /static endpoint.
router.post('/avatar/static', async (req, res) => {
  const url = typeof req.body?.url === 'string' ? req.body.url.trim() : ''
  if (!url) return res.status(400).json({ error: 'url is required' })
  if (url.length > 2048) return res.status(400).json({ error: 'url is too long' })
  if (!/^(https?:\/\/|\/)[^\s"'<>]+$/i.test(url)) {
    return res.status(400).json({ error: 'url must be an absolute URL or a root-relative path' })
  }
  res.json({ url })
})

export default router
