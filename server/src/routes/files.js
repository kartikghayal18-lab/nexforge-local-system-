import { Router } from 'express'
import { pool } from '../db/pool.js'
import { buildStorageKey, presignPut, presignGet, deleteObject, MAX_FILE_SIZE_BYTES } from '../lib/r2.js'

const router = Router()

router.get('/project/:projectId', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM project_files WHERE project_id = $1 ORDER BY created_at DESC', [req.params.projectId])
  res.json(rows)
})

// Step 1: ask for a presigned PUT URL. Frontend PUTs bytes directly to R2.
router.post('/project/:projectId/presign', async (req, res) => {
  const { fileName, contentType, size } = req.body || {}
  if (!fileName) return res.status(400).json({ error: 'fileName is required' })
  if (typeof size === 'number' && size > MAX_FILE_SIZE_BYTES) {
    return res.status(400).json({ error: `File too large (max ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB)` })
  }
  const storageKey = buildStorageKey(req.params.projectId, fileName)
  const uploadUrl = await presignPut(storageKey, contentType)
  res.json({ uploadUrl, storageKey })
})

// Step 2: after the PUT succeeds, record metadata.
router.post('/project/:projectId/confirm', async (req, res) => {
  const b = req.body || {}
  const { rows } = await pool.query(
    'INSERT INTO project_files (project_id, file_name, file_type, file_size, storage_key, url, category) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
    [req.params.projectId, b.fileName, b.contentType ?? null, b.size ?? 0, b.storageKey, b.url ?? null, b.category ?? null],
  )
  res.json(rows[0])
})

router.get('/:id/download', async (req, res) => {
  const { rows } = await pool.query('SELECT storage_key FROM project_files WHERE id = $1', [req.params.id])
  if (!rows.length) return res.status(404).json({ error: 'not found' })
  const url = await presignGet(rows[0].storage_key)
  res.json({ url })
})

router.delete('/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT storage_key FROM project_files WHERE id = $1', [req.params.id])
  if (rows.length) {
    try { await deleteObject(rows[0].storage_key) } catch (err) { console.error('[files] R2 delete failed', err) }
  }
  await pool.query('DELETE FROM project_files WHERE id = $1', [req.params.id])
  res.json({ ok: true })
})

export default router
