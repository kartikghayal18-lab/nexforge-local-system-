import { Router } from 'express'
import { pool } from '../db/pool.js'

const router = Router()

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

export default router
