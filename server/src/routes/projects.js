import { Router } from 'express'
import multer from 'multer'
import { pool } from '../db/pool.js'
import { saveImage, deleteImage, validateImageUpload, MAX_IMAGE_SIZE_BYTES } from '../lib/storage/index.js'

const router = Router()

// Memory storage: we validate (MIME + magic bytes + size) and hand the
// buffer to the storage abstraction ourselves, rather than letting multer
// write straight to disk unvalidated.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_IMAGE_SIZE_BYTES } })

const FIELDS = [
  'name', 'client_id', 'client', 'description', 'status', 'category', 'tech_stack',
  'framework', 'backend', 'database_type', 'hosting', 'repository_url', 'live_url',
  'staging_url', 'start_date', 'deadline', 'budget', 'notes',
]

router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM projects ORDER BY created_at DESC')
  res.json(rows)
})

router.get('/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM projects WHERE id = $1', [req.params.id])
  if (!rows.length) return res.status(404).json(null)
  res.json(rows[0])
})

router.post('/', async (req, res) => {
  const b = req.body || {}
  const cols = FIELDS
  const values = cols.map((c) => b[c] ?? null)
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(',')
  const { rows } = await pool.query(
    `INSERT INTO projects (${cols.join(',')}) VALUES (${placeholders}) RETURNING id`,
    values,
  )
  res.json({ id: rows[0].id })
})

router.put('/:id', async (req, res) => {
  const b = req.body || {}
  const cols = FIELDS
  const setClause = cols.map((c, i) => `${c}=$${i + 1}`).join(', ')
  const values = cols.map((c) => b[c] ?? null)
  values.push(req.params.id)
  await pool.query(`UPDATE projects SET ${setClause}, updated_at=now() WHERE id=$${values.length}`, values)
  res.json({ ok: true })
})

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM projects WHERE id = $1', [req.params.id])
  res.json({ ok: true })
})

// --- Project links ---
router.get('/:id/links', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM project_links WHERE project_id = $1', [req.params.id])
  res.json(rows)
})
router.post('/:id/links', async (req, res) => {
  const b = req.body || {}
  const { rows } = await pool.query(
    'INSERT INTO project_links (project_id, type, url, label) VALUES ($1,$2,$3,$4) RETURNING id',
    [req.params.id, b.type, b.url, b.label ?? null],
  )
  res.json({ id: rows[0].id })
})
router.delete('/links/:linkId', async (req, res) => {
  await pool.query('DELETE FROM project_links WHERE id = $1', [req.params.linkId])
  res.json({ ok: true })
})

// --- Project notes ---
router.get('/notes/all', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT n.*, p.name AS project_name FROM project_notes n
     JOIN projects p ON p.id = n.project_id
     ORDER BY n.updated_at DESC`
  )
  res.json(rows)
})
router.get('/:id/notes', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM project_notes WHERE project_id = $1 ORDER BY created_at DESC', [req.params.id])
  res.json(rows)
})
router.post('/:id/notes', async (req, res) => {
  const b = req.body || {}
  const { rows } = await pool.query(
    'INSERT INTO project_notes (project_id, title, content) VALUES ($1,$2,$3) RETURNING id',
    [req.params.id, b.title, b.content ?? null],
  )
  res.json({ id: rows[0].id })
})
router.put('/notes/:noteId', async (req, res) => {
  const b = req.body || {}
  await pool.query('UPDATE project_notes SET title=$1, content=$2, updated_at=now() WHERE id=$3', [
    b.title, b.content ?? null, req.params.noteId,
  ])
  res.json({ ok: true })
})
router.delete('/notes/:noteId', async (req, res) => {
  await pool.query('DELETE FROM project_notes WHERE id = $1', [req.params.noteId])
  res.json({ ok: true })
})

// --- Project images (cover + gallery) ---
// GET is folded into nothing special here (kept as its own endpoint, same
// convention as /links and /notes above) rather than embedded in the
// project GET response, so the gallery can be paged/refreshed independently.
router.get('/:id/images', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM project_images WHERE project_id = $1 ORDER BY is_cover DESC, created_at DESC',
    [req.params.id],
  )
  res.json(rows)
})

// POST /:id/images — multipart/form-data, field name "image", optional
// field "isCover" ('true' | 'false'). If the project has no images yet, the
// first upload always becomes the cover regardless of isCover.
router.post('/:id/images', upload.single('image'), async (req, res) => {
  const projectId = req.params.id
  if (!req.file) return res.status(400).json({ error: 'No image file provided (field name must be "image")' })

  const { buffer, originalname, mimetype, size } = req.file
  const validation = validateImageUpload({ buffer, mimeType: mimetype, originalName: originalname, size })
  if (!validation.ok) return res.status(400).json({ error: validation.error })

  const { rows: existing } = await pool.query('SELECT id FROM project_images WHERE project_id = $1 LIMIT 1', [projectId])
  const wantsCover = req.body?.isCover === 'true' || existing.length === 0

  const { key, url, resourceType, format } = await saveImage({ buffer, projectId, originalName: originalname, mimeType: mimetype })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    if (wantsCover) {
      await client.query('UPDATE project_images SET is_cover = false WHERE project_id = $1 AND is_cover = true', [projectId])
    }
    const { rows } = await client.query(
      `INSERT INTO project_images (project_id, url, storage_key, is_cover, file_name, file_size, mime_type, resource_type, format)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [projectId, url, key, wantsCover, originalname, size, mimetype, resourceType ?? null, format ?? null],
    )
    await client.query('COMMIT')
    res.json(rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    // Best-effort cleanup of the file we just wrote if the DB insert failed.
    await deleteImage(key).catch(() => {})
    throw err
  } finally {
    client.release()
  }
})

// POST /:id/images/static — record an image that already exists as a
// committed static asset (e.g. under the Vite frontend's
// public/images/projects/, deployed to Vercel as a normal build artifact)
// WITHOUT going through multer/upload validation — there are no bytes here,
// just a URL/path string the caller is vouching for. Same table, same `url`
// column as an uploaded image; `storage_key` is left null since there is no
// backend-managed file for us to ever delete.
const MAX_STATIC_URL_LENGTH = 2048
router.post('/:id/images/static', async (req, res) => {
  const projectId = req.params.id
  const url = typeof req.body?.url === 'string' ? req.body.url.trim() : ''
  if (!url) return res.status(400).json({ error: 'url is required' })
  if (url.length > MAX_STATIC_URL_LENGTH) return res.status(400).json({ error: 'url is too long' })
  // Not full validation of upload bytes (there are none) — just enough to
  // reject obviously-wrong values: must look like a path or URL, not
  // something like a script tag or a bare word.
  if (!/^(https?:\/\/|\/)[^\s"'<>]+$/i.test(url)) {
    return res.status(400).json({ error: 'url must be an absolute URL or a root-relative path (e.g. /images/projects/foo.png)' })
  }

  const { rows: existing } = await pool.query('SELECT id FROM project_images WHERE project_id = $1 LIMIT 1', [projectId])
  const wantsCover = req.body?.isCover === true || req.body?.isCover === 'true' || existing.length === 0

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    if (wantsCover) {
      await client.query('UPDATE project_images SET is_cover = false WHERE project_id = $1 AND is_cover = true', [projectId])
    }
    const { rows } = await client.query(
      `INSERT INTO project_images (project_id, url, storage_key, is_cover, file_name, file_size, mime_type)
       VALUES ($1,$2,'',$3,$4,NULL,NULL) RETURNING *`,
      [projectId, url, wantsCover, url.split('/').pop() || null],
    )
    await client.query('COMMIT')
    res.json(rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
})

router.patch('/:id/images/:imageId/cover', async (req, res) => {
  const { id: projectId, imageId } = req.params
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('UPDATE project_images SET is_cover = false WHERE project_id = $1 AND is_cover = true', [projectId])
    const { rows } = await client.query(
      'UPDATE project_images SET is_cover = true WHERE id = $1 AND project_id = $2 RETURNING *',
      [imageId, projectId],
    )
    if (!rows.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Image not found' })
    }
    await client.query('COMMIT')
    res.json(rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
})

router.delete('/:id/images/:imageId', async (req, res) => {
  const { id: projectId, imageId } = req.params
  const { rows } = await pool.query('SELECT storage_key FROM project_images WHERE id = $1 AND project_id = $2', [imageId, projectId])
  if (rows.length) {
    try { await deleteImage(rows[0].storage_key) } catch (err) { console.error('[projects] image delete failed', err) }
  }
  await pool.query('DELETE FROM project_images WHERE id = $1 AND project_id = $2', [imageId, projectId])
  res.json({ ok: true })
})

export default router
