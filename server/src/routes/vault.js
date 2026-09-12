import { Router } from 'express'
import { pool } from '../db/pool.js'
import { encrypt, decrypt, mask } from '../lib/crypto.js'

const router = Router()

// ---------------- Secrets ----------------
router.get('/secrets', async (req, res) => {
  const projectId = req.query.project_id || null
  const { rows } = projectId
    ? await pool.query('SELECT * FROM project_secrets WHERE project_id = $1 ORDER BY created_at DESC', [projectId])
    : await pool.query('SELECT * FROM project_secrets ORDER BY created_at DESC')
  res.json(rows.map((r) => ({
    id: r.id, project_id: r.project_id, name: r.name, category: r.category, environment: r.environment,
    notes: r.notes, created_at: r.created_at, updated_at: r.updated_at, value: mask(),
  })))
})

router.post('/secrets', async (req, res) => {
  const b = req.body || {}
  const { rows } = await pool.query(
    'INSERT INTO project_secrets (project_id, name, category, environment, encrypted_value, notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
    [b.project_id ?? null, b.name, b.category, b.environment, encrypt(b.value), b.notes ?? null],
  )
  res.json({ id: rows[0].id })
})

router.put('/secrets/:id', async (req, res) => {
  const b = req.body || {}
  if (b.new_value) {
    await pool.query(
      'UPDATE project_secrets SET name=$1, category=$2, environment=$3, notes=$4, encrypted_value=$5, updated_at=now() WHERE id=$6',
      [b.name, b.category, b.environment, b.notes ?? null, encrypt(b.new_value), req.params.id],
    )
  } else {
    await pool.query(
      'UPDATE project_secrets SET name=$1, category=$2, environment=$3, notes=$4, updated_at=now() WHERE id=$5',
      [b.name, b.category, b.environment, b.notes ?? null, req.params.id],
    )
  }
  res.json({ ok: true })
})

router.delete('/secrets/:id', async (req, res) => {
  await pool.query('DELETE FROM project_secrets WHERE id = $1', [req.params.id])
  res.json({ ok: true })
})

// Reveal is a separate, explicit endpoint — never returned by list.
router.get('/secrets/:id/reveal', async (req, res) => {
  const { rows } = await pool.query('SELECT encrypted_value FROM project_secrets WHERE id = $1', [req.params.id])
  if (!rows.length) return res.status(404).json({ error: 'not found' })
  res.json({ value: decrypt(rows[0].encrypted_value) })
})

// ---------------- Passwords ----------------
router.get('/passwords', async (req, res) => {
  const projectId = req.query.project_id || null
  const { rows } = projectId
    ? await pool.query('SELECT * FROM project_passwords WHERE project_id = $1 ORDER BY created_at DESC', [projectId])
    : await pool.query('SELECT * FROM project_passwords ORDER BY created_at DESC')
  res.json(rows.map((r) => ({
    id: r.id, project_id: r.project_id, title: r.title, username: r.username, website_url: r.website_url,
    environment: r.environment, notes: r.notes, created_at: r.created_at, updated_at: r.updated_at,
  })))
})

router.post('/passwords', async (req, res) => {
  const b = req.body || {}
  const { rows } = await pool.query(
    'INSERT INTO project_passwords (project_id, title, username, encrypted_password, website_url, environment, notes) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
    [b.project_id ?? null, b.title, b.username ?? null, encrypt(b.password), b.website_url ?? null, b.environment ?? null, b.notes ?? null],
  )
  res.json({ id: rows[0].id })
})

router.put('/passwords/:id', async (req, res) => {
  const b = req.body || {}
  if (b.new_password) {
    await pool.query(
      'UPDATE project_passwords SET title=$1, username=$2, website_url=$3, environment=$4, notes=$5, encrypted_password=$6, updated_at=now() WHERE id=$7',
      [b.title, b.username ?? null, b.website_url ?? null, b.environment ?? null, b.notes ?? null, encrypt(b.new_password), req.params.id],
    )
  } else {
    await pool.query(
      'UPDATE project_passwords SET title=$1, username=$2, website_url=$3, environment=$4, notes=$5, updated_at=now() WHERE id=$6',
      [b.title, b.username ?? null, b.website_url ?? null, b.environment ?? null, b.notes ?? null, req.params.id],
    )
  }
  res.json({ ok: true })
})

router.delete('/passwords/:id', async (req, res) => {
  await pool.query('DELETE FROM project_passwords WHERE id = $1', [req.params.id])
  res.json({ ok: true })
})

router.get('/passwords/:id/reveal', async (req, res) => {
  const { rows } = await pool.query('SELECT encrypted_password FROM project_passwords WHERE id = $1', [req.params.id])
  if (!rows.length) return res.status(404).json({ error: 'not found' })
  res.json({ value: decrypt(rows[0].encrypted_password) })
})

// ---------------- Databases ----------------
router.get('/databases', async (req, res) => {
  const projectId = req.query.project_id || null
  const { rows } = projectId
    ? await pool.query('SELECT * FROM project_databases WHERE project_id = $1 ORDER BY created_at DESC', [projectId])
    : await pool.query('SELECT * FROM project_databases ORDER BY created_at DESC')
  res.json(rows.map((r) => ({
    id: r.id, project_id: r.project_id, name: r.name, provider: r.provider, host: r.host, port: r.port,
    database_name: r.database_name, username: r.username, environment: r.environment,
    has_connection_string: !!r.encrypted_connection_string, has_password: !!r.encrypted_password,
    created_at: r.created_at, updated_at: r.updated_at,
  })))
})

router.post('/databases', async (req, res) => {
  const b = req.body || {}
  const { rows } = await pool.query(
    `INSERT INTO project_databases (project_id, name, provider, host, port, database_name, username, encrypted_connection_string, encrypted_password, environment)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [b.project_id ?? null, b.name, b.provider, b.host ?? null, b.port ?? null, b.database_name ?? null, b.username ?? null,
      b.connection_string ? encrypt(b.connection_string) : null, b.password ? encrypt(b.password) : null, b.environment ?? null],
  )
  res.json({ id: rows[0].id })
})

router.put('/databases/:id', async (req, res) => {
  const b = req.body || {}
  const sets = ['name=$1', 'provider=$2', 'host=$3', 'port=$4', 'database_name=$5', 'username=$6', 'environment=$7', 'updated_at=now()']
  const values = [b.name, b.provider, b.host ?? null, b.port ?? null, b.database_name ?? null, b.username ?? null, b.environment ?? null]
  let idx = values.length
  if (b.new_connection_string) { idx++; sets.push(`encrypted_connection_string=$${idx}`); values.push(encrypt(b.new_connection_string)) }
  if (b.new_password) { idx++; sets.push(`encrypted_password=$${idx}`); values.push(encrypt(b.new_password)) }
  idx++
  values.push(req.params.id)
  await pool.query(`UPDATE project_databases SET ${sets.join(', ')} WHERE id=$${idx}`, values)
  res.json({ ok: true })
})

router.delete('/databases/:id', async (req, res) => {
  await pool.query('DELETE FROM project_databases WHERE id = $1', [req.params.id])
  res.json({ ok: true })
})

router.get('/databases/:id/reveal', async (req, res) => {
  const { rows } = await pool.query('SELECT encrypted_connection_string, encrypted_password FROM project_databases WHERE id = $1', [req.params.id])
  if (!rows.length) return res.status(404).json({ error: 'not found' })
  res.json({
    connection_string: rows[0].encrypted_connection_string ? decrypt(rows[0].encrypted_connection_string) : null,
    password: rows[0].encrypted_password ? decrypt(rows[0].encrypted_password) : null,
  })
})

export default router
