import { Router } from 'express'
import { pool } from '../db/pool.js'
import { deleteImage } from '../lib/storage/index.js'
import { deleteObject as deleteR2Object } from '../lib/r2.js'
import { deleteAllWorkspaceData, collectLocalImageStorageKeys } from '../lib/workspaceReset.js'
import { compareOtpCode, MAX_VERIFY_ATTEMPTS } from '../lib/otp.js'

const router = Router()

// Full account deletion — deliberately its own route/module, not a variant
// of workspace reset, so the two can never be triggered by the same click
// path (see src/pages/Settings.tsx for the UI separation the owner asked for).
//
// Re-auth choice: this app supports both password and email-OTP login, but
// an OTP-created account has no *usable* password (see auth.js — it's
// seeded with a random unusable hash), so a password re-auth check can't
// work uniformly across every account. A fresh OTP code can: it works the
// same way regardless of how the account normally signs in, and reuses
// exactly the send-otp code path already implemented (the client calls the
// existing POST /api/auth/send-otp for its own email, then supplies the
// resulting code here). The code is verified against req.userEmail from the
// JWT — never an email taken from the request body — so this can only ever
// re-authenticate the account making the request.
router.delete('/', async (req, res) => {
  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : ''
  if (!code) return res.status(400).json({ error: 'A fresh verification code (code) is required to delete your account' })

  const { rows: otpRows } = await pool.query(
    'SELECT * FROM otp_codes WHERE email = $1 AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1',
    [req.userEmail],
  )
  const otpRow = otpRows[0]
  if (!otpRow) return res.status(400).json({ error: 'Invalid or expired code. Request a new code first.' })
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
  await pool.query('UPDATE otp_codes SET consumed_at = now() WHERE id = $1', [otpRow.id])

  const client = await pool.connect()
  let localImageKeys = []
  let r2FileKeys = []
  try {
    await client.query('BEGIN')
    localImageKeys = await collectLocalImageStorageKeys(client)
    r2FileKeys = (await client.query("SELECT storage_key FROM project_files WHERE storage_key IS NOT NULL AND storage_key <> ''")).rows.map((r) => r.storage_key)
    await deleteAllWorkspaceData(client)
    // KNOWN LIMITATION: the profile avatar's local file (if any) is not
    // cleaned up here — /api/profile/avatar returns only the served URL,
    // not a deletable storage key (see server/src/routes/profile.js), so
    // there is nothing to hand deleteImage(). An orphaned avatar file is a
    // minor, low-stakes leftover next to a fully deleted account and its
    // workspace data.
    await client.query('DELETE FROM otp_codes WHERE email = $1', [req.userEmail])
    await client.query('DELETE FROM users WHERE id = $1', [req.userId])
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }

  for (const key of localImageKeys) {
    try { await deleteImage(key) } catch (err) { console.error('[account] failed to delete local image', key, err) }
  }
  for (const key of r2FileKeys) {
    try { await deleteR2Object(key) } catch (err) { console.error('[account] failed to delete R2 file', key, err) }
  }

  res.json({ ok: true })
})

export default router
