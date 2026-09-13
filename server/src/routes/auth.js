import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import { pool } from '../db/pool.js'
import { requireAuth } from '../middleware/auth.js'
import { sendOtpEmail } from '../lib/email.js'
import {
  generateOtpCode, hashOtpCode, compareOtpCode, checkSendRateLimit,
  OTP_EXPIRY_MS, MAX_VERIFY_ATTEMPTS,
} from '../lib/otp.js'

const router = Router()

// Reused by /login, /register AND /verify-otp so every path into the app
// issues an identical token — AuthContext/requireAuth need zero changes
// for whichever login method was used.
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

// --- Email OTP (one-time code) login ---
// Two-step flow: POST /send-otp issues a code by email; POST /verify-otp
// checks it and logs the user in (creating the single owner account if
// this is the very first successful OTP verification and no user exists
// yet — see the comment in /verify-otp below).

router.post('/send-otp', async (req, res) => {
  const rawEmail = req.body?.email
  if (!rawEmail || typeof rawEmail !== 'string') {
    return res.status(400).json({ error: 'email is required' })
  }
  const email = rawEmail.toLowerCase().trim()

  // Same generic response is returned no matter what happens below —
  // whether the email belongs to the owner, a typo, or nobody at all, the
  // response must never reveal which. Rate-limit errors are the one
  // exception the task calls for (they're needed for the resend-countdown
  // UI) — but a rate-limit hit for the OWNER's email vs. a made-up email
  // reads identically either way, since it is purely a function of how
  // many otp_codes rows exist for that exact email string, so it still
  // reveals nothing about whether the address is real.
  const GENERIC_SUCCESS = { ok: true, message: 'If that email is valid, a code has been sent.' }

  const { rows: recent } = await pool.query(
    "SELECT created_at FROM otp_codes WHERE email = $1 AND created_at > now() - interval '1 hour' ORDER BY created_at DESC",
    [email],
  )
  const rateLimit = checkSendRateLimit(recent.map((r) => r.created_at))
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: rateLimit.error, waitSeconds: rateLimit.waitSeconds })
  }

  const code = generateOtpCode()
  const codeHash = await hashOtpCode(code)
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS)
  await pool.query(
    'INSERT INTO otp_codes (email, code_hash, expires_at) VALUES ($1,$2,$3)',
    [email, codeHash, expiresAt],
  )

  // Best-effort send — if Resend itself fails (bad key, network, etc.) we
  // still don't want to reveal anything about the email via a different
  // response shape, so this is logged, not surfaced to the client.
  try {
    await sendOtpEmail(email, code)
  } catch (err) {
    console.error('[auth] failed to send OTP email:', err)
  }

  res.json(GENERIC_SUCCESS)
})

router.post('/verify-otp', async (req, res) => {
  const rawEmail = req.body?.email
  const rawCode = req.body?.code
  if (!rawEmail || typeof rawEmail !== 'string' || !rawCode || typeof rawCode !== 'string') {
    return res.status(400).json({ error: 'email and code are required' })
  }
  const email = rawEmail.toLowerCase().trim()
  const code = rawCode.trim()

  const { rows: otpRows } = await pool.query(
    `SELECT * FROM otp_codes WHERE email = $1 AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1`,
    [email],
  )
  const otpRow = otpRows[0]
  if (!otpRow) return res.status(400).json({ error: 'Invalid or expired code' })

  if (new Date(otpRow.expires_at).getTime() < Date.now()) {
    return res.status(400).json({ error: 'This code has expired. Request a new one.' })
  }
  if (otpRow.attempt_count >= MAX_VERIFY_ATTEMPTS) {
    return res.status(429).json({ error: 'Too many attempts for this code. Request a new one.' })
  }

  const matches = await compareOtpCode(code, otpRow.code_hash)
  if (!matches) {
    await pool.query('UPDATE otp_codes SET attempt_count = attempt_count + 1 WHERE id = $1', [otpRow.id])
    return res.status(400).json({ error: 'Invalid or expired code' })
  }

  // Single-use: consume immediately so this exact code can never be
  // replayed, success or failure downstream notwithstanding.
  await pool.query('UPDATE otp_codes SET consumed_at = now() WHERE id = $1', [otpRow.id])

  const { rows: userRows } = await pool.query('SELECT id, email FROM users WHERE email = $1', [email])
  let user = userRows[0]

  if (!user) {
    // Mirrors /register's single-owner rule exactly: a brand-new user may
    // only be created here if no user exists yet. By this point the caller
    // has already proven control of the inbox (a valid, unexpired,
    // not-yet-used code), so — unlike send-otp — it's fine to say plainly
    // that no account exists for this email.
    const { rows: countRows } = await pool.query('SELECT count(*)::int AS n FROM users')
    if (countRows[0].n > 0) {
      return res.status(404).json({ error: 'No account exists for this email.' })
    }
    // OTP-created accounts have no password; store an unusable random hash
    // so the NOT NULL password_hash column is satisfied without ever
    // producing a working password-login credential.
    const unusablePasswordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12)
    const { rows } = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1,$2) RETURNING id, email, created_at',
      [email, unusablePasswordHash],
    )
    user = rows[0]
  }

  const token = signToken(user)
  res.json({ token, user: { id: user.id, email: user.email } })
})

// Stateless JWTs, no server-side session table — there is nothing here to
// revoke server-side. This route exists for symmetry with login/register
// and as a future hook (e.g. a token-blacklist table) if that's ever
// needed; today it is a no-op and the REAL logout is the client discarding
// its token (see src/auth/AuthContext.tsx logout()).
router.post('/logout', (req, res) => {
  res.json({ ok: true })
})

router.get('/me', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT id, email, created_at FROM users WHERE id = $1', [req.userId])
  if (!rows.length) return res.status(404).json({ error: 'not found' })
  res.json(rows[0])
})

export default router
