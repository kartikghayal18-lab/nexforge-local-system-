import { Router } from 'express'
import { pool } from '../db/pool.js'

const router = Router()

router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM clients ORDER BY created_at DESC')
  res.json(rows)
})

router.get('/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM clients WHERE id = $1', [req.params.id])
  if (!rows.length) return res.status(404).json({ error: 'not found' })
  res.json(rows[0])
})

router.post('/', async (req, res) => {
  const b = req.body || {}
  const { rows } = await pool.query(
    `INSERT INTO clients (name, company, email, phone, address, website, gstin, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [b.name, b.company ?? null, b.email ?? null, b.phone ?? null, b.address ?? null, b.website ?? null, b.gstin ?? null, b.notes ?? null],
  )
  res.json({ id: rows[0].id })
})

router.put('/:id', async (req, res) => {
  const b = req.body || {}
  await pool.query(
    `UPDATE clients SET name=$1, company=$2, email=$3, phone=$4, address=$5, website=$6, gstin=$7, notes=$8, updated_at=now()
     WHERE id=$9`,
    [b.name, b.company ?? null, b.email ?? null, b.phone ?? null, b.address ?? null, b.website ?? null, b.gstin ?? null, b.notes ?? null, req.params.id],
  )
  res.json({ ok: true })
})

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM clients WHERE id = $1', [req.params.id])
  res.json({ ok: true })
})

export default router
