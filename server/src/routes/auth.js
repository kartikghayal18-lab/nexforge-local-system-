import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { pool } from '../db/pool.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' })
}

// Single-owner app: registration only works while no user exists yet.
router.post('/register', async (req, res) => {
  const { email, password } = req.body || {}
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' })
  if (String(password).length < 8) return res.status(400).json({ error: 'password must be at least 8 characters' })

  const { rows: countRows } = await pool.query('SELECT count(*)::int AS n FROM users')
  if (countRows[0].n > 0) {
    return res.status(403).json({ error: 'Registration is closed. This is a single-owner app.' })
  }

  const passwordHash = await bcrypt.hash(password, 12)
  try {
    const { rows } = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
      [email.toLowerCase().trim(), passwordHash],
    )
    const user = rows[0]
    const token = signToken(user)
    res.json({ token, user: { id: user.id, email: user.email } })
  } catch (err) {
    if (err.code === '23505') return res.status(403).json({ error: 'Registration is closed.' })
    throw err
  }
})

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {}
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' })

  const { rows } = await pool.query('SELECT id, email, password_hash FROM users WHERE email = $1', [
    email.toLowerCase().trim(),
  ])
  // Never reveal whether the email exists.
  const genericError = () => res.status(401).json({ error: 'Invalid email or password' })
  if (!rows.length) return genericError()

  const user = rows[0]
  const ok = await bcrypt.compare(password, user.password_hash)
  if (!ok) return genericError()

  const token = signToken(user)
  res.json({ token, user: { id: user.id, email: user.email } })
})

router.get('/me', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT id, email, created_at FROM users WHERE id = $1', [req.userId])
  if (!rows.length) return res.status(404).json({ error: 'not found' })
  res.json(rows[0])
})

export default router
