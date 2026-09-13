import { Router } from 'express'
import multer from 'multer'
import { pool } from '../db/pool.js'
import { uploadBuffer, destroyAsset, folders } from '../lib/cloudinary.js'
import { validateImageUpload, MAX_IMAGE_SIZE_BYTES } from '../lib/storage/index.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_IMAGE_SIZE_BYTES } })

router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT key, value FROM business_settings')
  res.json(Object.fromEntries(rows.map((r) => [r.key, r.value])))
})

router.put('/', async (req, res) => {
  const values = req.body || {}
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const [key, value] of Object.entries(values)) {
      await client.query(
        `INSERT INTO business_settings (key, value, updated_at) VALUES ($1,$2,now())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
        [key, String(value)],
      )
    }
    await client.query('COMMIT')
    res.json({ ok: true })
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
})

async function getSetting(key) {
  const { rows } = await pool.query('SELECT value FROM business_settings WHERE key = $1', [key])
  return rows[0]?.value ?? null
}

async function upsertSettings(client, entries) {
  for (const [key, value] of Object.entries(entries)) {
    await client.query(
      `INSERT INTO business_settings (key, value, updated_at) VALUES ($1,$2,now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [key, String(value)],
    )
  }
}

// POST /logo — multipart/form-data, field name "logo". Replaces the old
// business_logo_base64 pattern (a raw base64 string stuffed into the
// generic settings key/value store) with a real Cloudinary upload; only
// the resulting URL + Cloudinary public_id are ever stored. Mirrors the
// response shape coreApi.profileAvatarUpload already uses ({ url }).
router.post('/logo', upload.single('logo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image file provided (field name must be "logo")' })
  const { buffer, originalname, mimetype, size } = req.file
  const validation = validateImageUpload({ buffer, mimeType: mimetype, originalName: originalname, size })
  if (!validation.ok) return res.status(400).json({ error: validation.error })

  // Destroy the previous logo (if any) before uploading the new one, so a
  // "replace logo" flow doesn't accumulate orphaned Cloudinary assets.
  const previousPublicId = await getSetting('logo_public_id')

  const result = await uploadBuffer(buffer, {
    folder: folders.businessLogo(),
    resourceType: 'image',
    originalFilename: originalname,
  })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await upsertSettings(client, { logo_public_id: result.public_id, logo_url: result.secure_url })
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }

  if (previousPublicId) {
    await destroyAsset(previousPublicId, 'image')
  }

  res.json({ url: result.secure_url })
})

export default router
