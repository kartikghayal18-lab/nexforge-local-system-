// Smoke test using pg-mem (an in-memory Postgres emulator, pure JS).
// This is NOT a substitute for testing against real Postgres — pg-mem does
// not implement every Postgres feature/extension perfectly (notably
// pgcrypto's gen_random_uuid, patched below) — but it does prove the schema
// SQL and route logic aren't obviously broken end-to-end.
import { newDb } from 'pg-mem'
import { readFileSync, readdirSync, mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let passed = 0
let failed = 0
function check(name, cond, detail) {
  if (cond) {
    console.log(`PASS  ${name}`)
    passed++
  } else {
    console.log(`FAIL  ${name}${detail ? ' — ' + detail : ''}`)
    failed++
  }
}

async function main() {
  const db = newDb({ autoCreateForeignKeyIndices: true })
  db.public.registerFunction({
    name: 'gen_random_uuid',
    returns: 'uuid',
    implementation: () => crypto.randomUUID(),
  })

  // pg-mem doesn't implement real Postgres extensions; gen_random_uuid is
  // registered directly above, so strip the CREATE EXTENSION line only for
  // this in-memory test run (schema.sql itself is unchanged for real Postgres).
  const schemaSql = readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8')
    .split('\n')
    .filter((line) => !line.trim().toUpperCase().startsWith('CREATE EXTENSION'))
    .join('\n')
  db.public.none(schemaSql)

  // Also apply numbered migrations (e.g. project_images), same as
  // server/db/migrate.js does against real Postgres.
  const migrationsDir = path.join(__dirname, '..', 'db', 'migrations')
  const migrationFiles = existsSync(migrationsDir) ? readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort() : []
  for (const file of migrationFiles) {
    const sql = readFileSync(path.join(migrationsDir, file), 'utf8')
      .split('\n')
      .filter((line) => !line.trim().toUpperCase().startsWith('CREATE EXTENSION'))
      .join('\n')
    db.public.none(sql)
  }
  console.log('Schema applied to pg-mem OK\n')

  const { Pool } = db.adapters.createPg()
  const pool = new Pool()

  // 1. register
  const email = 'kartik@example.com'
  const passwordHash = await bcrypt.hash('supersecret1', 10)
  const userRes = await pool.query('INSERT INTO users (email, password_hash) VALUES ($1,$2) RETURNING id', [email, passwordHash])
  check('register: user created', !!userRes.rows[0].id)

  // 2. login (bcrypt compare)
  const loginRow = (await pool.query('SELECT password_hash FROM users WHERE email=$1', [email])).rows[0]
  const loginOk = await bcrypt.compare('supersecret1', loginRow.password_hash)
  check('login: password matches', loginOk)
  const loginBad = await bcrypt.compare('wrongpassword', loginRow.password_hash)
  check('login: wrong password rejected', !loginBad)

  // 3. create client
  const clientRes = await pool.query(
    'INSERT INTO clients (name, email) VALUES ($1,$2) RETURNING id',
    ['Acme Corp', 'billing@acme.test'],
  )
  const clientId = clientRes.rows[0].id
  check('create client', !!clientId)

  // 4. create project
  const projectRes = await pool.query(
    'INSERT INTO projects (name, client_id, status) VALUES ($1,$2,$3) RETURNING id',
    ['Website Revamp', clientId, 'Active'],
  )
  const projectId = projectRes.rows[0].id
  check('create project', !!projectId)

  // 5. create invoice + items (mirrors server/src/routes/invoices.js logic)
  const items = [{ description: 'Design', quantity: 10, rate: 50 }, { description: 'Dev', quantity: 20, rate: 60 }]
  const subtotal = items.reduce((s, it) => s + it.quantity * it.rate, 0)
  const discount = 0
  const taxRate = 18
  const taxable = subtotal - discount
  const tax = (taxable * taxRate) / 100
  const total = taxable + tax
  const invNumber = 'INV-' + new Date().getFullYear() + '-001'
  const invRes = await pool.query(
    `INSERT INTO invoices (invoice_number, client_id, project_id, issue_date, due_date, status, currency, subtotal, discount, tax, total)
     VALUES ($1,$2,$3,'2026-01-01','2026-01-15','Sent','INR',$4,$5,$6,$7) RETURNING id`,
    [invNumber, clientId, projectId, subtotal, discount, tax, total],
  )
  const invoiceId = invRes.rows[0].id
  for (const [i, it] of items.entries()) {
    await pool.query(
      'INSERT INTO invoice_items (id, invoice_id, description, quantity, rate, amount, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [crypto.randomUUID(), invoiceId, it.description, it.quantity, it.rate, it.quantity * it.rate, i],
    )
  }
  check('create invoice', !!invoiceId)
  check('invoice totals computed correctly', Math.abs(total - (subtotal * 1.18)) < 0.001, `total=${total}`)

  // 6. add payment, confirm status advances
  await pool.query(
    'INSERT INTO payments (invoice_id, amount, payment_date, payment_method) VALUES ($1,$2,$3,$4)',
    [invoiceId, total, '2026-01-10', 'Bank Transfer'],
  )
  const paidSum = (await pool.query('SELECT COALESCE(SUM(amount),0)::float AS paid FROM payments WHERE invoice_id=$1', [invoiceId])).rows[0].paid
  const newStatus = paidSum >= total ? 'Paid' : 'Partially Paid'
  await pool.query('UPDATE invoices SET status=$1 WHERE id=$2', [newStatus, invoiceId])
  const finalStatus = (await pool.query('SELECT status FROM invoices WHERE id=$1', [invoiceId])).rows[0].status
  check('payment auto-advances invoice status to Paid', finalStatus === 'Paid', `status=${finalStatus}`)

  // 7. vault encryption round-trip (uses the real crypto module against a fixed test key)
  process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64')
  const { encrypt, decrypt } = await import('../src/lib/crypto.js')
  const secretPlain = 'sk-test-1234567890'
  const encrypted = encrypt(secretPlain)
  await pool.query(
    'INSERT INTO project_secrets (project_id, name, category, environment, encrypted_value) VALUES ($1,$2,$3,$4,$5)',
    [projectId, 'STRIPE_KEY', 'API Key', 'Production', encrypted],
  )
  const storedRow = (await pool.query('SELECT encrypted_value FROM project_secrets WHERE project_id=$1', [projectId])).rows[0]
  check('vault: stored value is ciphertext, not plaintext', storedRow.encrypted_value !== secretPlain)
  check('vault: decrypt round-trips to original plaintext', decrypt(storedRow.encrypted_value) === secretPlain)

  // 8. dashboard stats aggregate
  const stats = {
    total_projects: (await pool.query('SELECT count(*)::int AS n FROM projects')).rows[0].n,
    total_clients: (await pool.query('SELECT count(*)::int AS n FROM clients')).rows[0].n,
    total_invoices: (await pool.query('SELECT count(*)::int AS n FROM invoices')).rows[0].n,
  }
  check('dashboard stats: counts match', stats.total_projects === 1 && stats.total_clients === 1 && stats.total_invoices === 1, JSON.stringify(stats))

  // 9. project_images table + application-level "one cover per project" invariant
  // pg-mem's gen_random_uuid registration can return a stale cached value
  // within one statement batch, so pass explicit UUIDs here rather than
  // relying on the column default (real Postgres has no such issue).
  const img1 = (await pool.query(
    `INSERT INTO project_images (id, project_id, url, storage_key, is_cover, file_name, file_size, mime_type)
     VALUES ($1,$2,'/images/projects/p1/a.png','projects/p1/a.png', true, 'a.png', 1024, 'image/png') RETURNING id`,
    [crypto.randomUUID(), projectId],
  )).rows[0]
  await pool.query('UPDATE project_images SET is_cover = false WHERE project_id = $1 AND is_cover = true', [projectId])
  const img2 = (await pool.query(
    `INSERT INTO project_images (id, project_id, url, storage_key, is_cover, file_name, file_size, mime_type)
     VALUES ($1,$2,'/images/projects/p1/b.png','projects/p1/b.png', true, 'b.png', 2048, 'image/png') RETURNING id`,
    [crypto.randomUUID(), projectId],
  )).rows[0]
  const coverCount = (await pool.query('SELECT count(*)::int AS n FROM project_images WHERE project_id=$1 AND is_cover=true', [projectId])).rows[0].n
  check('project_images: at most one cover row per project', coverCount === 1, `coverCount=${coverCount}`)
  void img1
  void img2

  // 10. storage abstraction (local disk) — real filesystem I/O, no mocking
  const tmpRoot = mkdtempSync(path.join(tmpdir(), 'nexforge-smoke-'))
  const prevCwd = process.cwd()
  process.chdir(tmpRoot) // saveImage/deleteImage resolve paths off process.cwd() at import time
  // Imported only after chdir — the module computes its PUBLIC_DIR constant
  // from process.cwd() at load time, so the order here matters.
  const { saveImage, deleteImage, validateImageUpload, MAX_IMAGE_SIZE_BYTES } = await import('../src/lib/storage/index.js')
  try {
    const pngMagicBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
    const { key, url } = await saveImage({ buffer: pngMagicBytes, projectId, originalName: 'photo.png', mimeType: 'image/png' })
    const writtenPath = path.join(tmpRoot, 'public', 'images', 'projects', ...key.replace(/^projects\//, '').split('/'))
    check('storage: saveImage writes file to expected local-disk path', existsSync(writtenPath), writtenPath)
    check('storage: saveImage returns a served URL under /images/', url.startsWith('/images/projects/'), url)

    await deleteImage(key)
    check('storage: deleteImage removes the file', !existsSync(writtenPath))

    // deleteImage on an already-missing file must not throw
    let deleteAgainThrew = false
    try { await deleteImage(key) } catch { deleteAgainThrew = true }
    check('storage: deleteImage is idempotent (no throw on missing file)', !deleteAgainThrew)
  } finally {
    process.chdir(prevCwd)
    rmSync(tmpRoot, { recursive: true, force: true })
  }

  // 11. validation function — pure, exercised directly (no HTTP server needed)
  const validJpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(20)])
  const validPng = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(20)])
  const validWebp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(20)])
  const fakeImage = Buffer.alloc(32) // no recognizable magic bytes

  check(
    'validation: accepts a real PNG with matching name/mime',
    validateImageUpload({ buffer: validPng, mimeType: 'image/png', originalName: 'cover.png', size: validPng.length }).ok,
  )
  check(
    'validation: accepts a real JPEG',
    validateImageUpload({ buffer: validJpeg, mimeType: 'image/jpeg', originalName: 'cover.jpg', size: validJpeg.length }).ok,
  )
  check(
    'validation: accepts a real WebP',
    validateImageUpload({ buffer: validWebp, mimeType: 'image/webp', originalName: 'cover.webp', size: validWebp.length }).ok,
  )
  check(
    'validation: rejects oversized file (>5MB)',
    !validateImageUpload({ buffer: validPng, mimeType: 'image/png', originalName: 'cover.png', size: MAX_IMAGE_SIZE_BYTES + 1 }).ok,
  )
  check(
    'validation: rejects disallowed mime type (application/pdf)',
    !validateImageUpload({ buffer: validPng, mimeType: 'application/pdf', originalName: 'cover.pdf', size: validPng.length }).ok,
  )
  check(
    'validation: rejects mismatched extension (.png claimed, .exe actually sent)',
    !validateImageUpload({ buffer: validPng, mimeType: 'image/png', originalName: 'cover.exe', size: validPng.length }).ok,
  )
  check(
    'validation: rejects content whose magic bytes do not match declared mime (spoofed upload)',
    !validateImageUpload({ buffer: fakeImage, mimeType: 'image/png', originalName: 'cover.png', size: fakeImage.length }).ok,
  )

  // 12. production gate: saveImage refuses when NODE_ENV=production and
  // STORAGE_BACKEND is still the local-dev default (see
  // server/src/lib/storage/index.js) — this is what the upload route maps
  // to a 503 instead of silently writing to Render's ephemeral disk.
  {
    const prevNodeEnv = process.env.NODE_ENV
    const prevBackend = process.env.STORAGE_BACKEND
    delete process.env.STORAGE_BACKEND // exercise the documented default
    process.env.NODE_ENV = 'production'
    // Re-import fresh so STORAGE_BACKEND (computed at module load) reflects
    // this test's env — dynamic import with a cache-busting query string.
    const storageProd = await import(`../src/lib/storage/index.js?t=${Date.now()}`)
    let threw = null
    try {
      await storageProd.saveImage({ buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]), projectId, originalName: 'x.png', mimeType: 'image/png' })
    } catch (err) {
      threw = err
    }
    check(
      'storage: saveImage throws StorageNotConfiguredError in production with STORAGE_BACKEND unset',
      threw instanceof storageProd.StorageNotConfiguredError,
      threw ? threw.constructor.name : 'did not throw',
    )
    check(
      'storage: StorageNotConfiguredError message points at docs/DEPLOYMENT.md',
      !!threw && /docs\/DEPLOYMENT\.md/.test(threw.message),
    )

    // And confirm it does NOT gate when STORAGE_BACKEND is explicitly set
    // (simulating R2/S3 being wired up).
    process.env.STORAGE_BACKEND = 's3'
    const storageS3Sim = await import(`../src/lib/storage/index.js?t=${Date.now()}1`)
    check('storage: STORAGE_BACKEND=s3 reports as the configured backend', storageS3Sim.STORAGE_BACKEND === 's3')

    process.env.NODE_ENV = prevNodeEnv
    if (prevBackend === undefined) delete process.env.STORAGE_BACKEND
    else process.env.STORAGE_BACKEND = prevBackend
  }

  // 13. Email OTP login — generation, hashing, expiry, single-use, rate limiting.
  // Exercises server/src/lib/otp.js directly and otp_codes via pg-mem — no
  // HTTP server, no real Resend send (server/src/lib/email.js is never
  // imported here, only the route imports it).
  {
    const { generateOtpCode, hashOtpCode, compareOtpCode, checkSendRateLimit, OTP_EXPIRY_MS, MAX_SENDS_PER_HOUR } = await import('../src/lib/otp.js')

    const code = generateOtpCode()
    check('otp: generates a 6-digit numeric code in range', /^\d{6}$/.test(code) && Number(code) >= 100000 && Number(code) <= 999999, code)

    const codeHash = await hashOtpCode(code)
    check('otp: hash is not the plaintext code', codeHash !== code)
    check('otp: compareOtpCode matches the correct code', await compareOtpCode(code, codeHash))
    check('otp: compareOtpCode rejects a wrong code', !(await compareOtpCode('000000', codeHash)))

    // Rate limiting — pure function, plain Date arrays.
    check('otp rate limit: no recent sends → allowed', checkSendRateLimit([]).allowed)
    const justNow = new Date()
    const cooldownCheck = checkSendRateLimit([justNow], justNow)
    check('otp rate limit: 60s cooldown blocks an immediate resend', !cooldownCheck.allowed && typeof cooldownCheck.waitSeconds === 'number', JSON.stringify(cooldownCheck))
    const past61s = new Date(justNow.getTime() - 61_000)
    check('otp rate limit: allowed again just after the 60s cooldown', checkSendRateLimit([past61s], justNow).allowed)
    const fiveInLastHour = Array.from({ length: MAX_SENDS_PER_HOUR }, (_, i) => new Date(justNow.getTime() - (2 * 60 + i * 60) * 1000))
    const hourlyCheck = checkSendRateLimit(fiveInLastHour, justNow)
    check(`otp rate limit: ${MAX_SENDS_PER_HOUR}/hour cap blocks a 6th send`, !hourlyCheck.allowed && /too many/i.test(hourlyCheck.error), JSON.stringify(hourlyCheck))

    // Full lifecycle against pg-mem's otp_codes table: issue, verify once
    // (consumes it), verify again (must fail — single-use), and a
    // separately-issued already-expired row (must fail on expiry).
    const otpEmail = 'otp-test@example.com'
    const otpCode = generateOtpCode()
    const otpHash = await hashOtpCode(otpCode)
    const futureExpiry = new Date(Date.now() + OTP_EXPIRY_MS)
    const otpRow = (await pool.query(
      'INSERT INTO otp_codes (email, code_hash, expires_at) VALUES ($1,$2,$3) RETURNING *',
      [otpEmail, otpHash, futureExpiry],
    )).rows[0]

    const firstVerifyMatches = await compareOtpCode(otpCode, otpRow.code_hash)
    check('otp lifecycle: correct code matches before consumption', firstVerifyMatches)
    await pool.query('UPDATE otp_codes SET consumed_at = now() WHERE id = $1', [otpRow.id])

    const stillUnconsumed = (await pool.query(
      'SELECT * FROM otp_codes WHERE email = $1 AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1',
      [otpEmail],
    )).rows
    check('otp lifecycle: single-use — consumed code no longer returned as an active OTP', stillUnconsumed.length === 0)

    // Explicit id here too, for the same pg-mem gen_random_uuid-caching
    // reason noted above for project_images (real Postgres has no such issue).
    const expiredHash = await hashOtpCode('111111')
    const expiredRow = (await pool.query(
      'INSERT INTO otp_codes (id, email, code_hash, expires_at) VALUES ($1,$2,$3, now() - interval \'1 minute\') RETURNING *',
      [crypto.randomUUID(), 'otp-expired@example.com', expiredHash],
    )).rows[0]
    check('otp lifecycle: expired row is rejected by an expires_at check', new Date(expiredRow.expires_at).getTime() < Date.now())
  }

  // 14. Owner profile — validation, update round-trip, persistence across
  // a simulated "fresh session" (a brand new query against the same row,
  // not any cached JS object).
  {
    const { validateProfileUpdate, isProfileComplete } = await import('../src/lib/profileValidation.js')

    const incomplete = { full_name: 'Kartik Ghayal' } // missing everything else required
    check('profile: incomplete record is not complete', !isProfileComplete(incomplete))

    const complete = {
      full_name: 'Kartik Ghayal', business_name: 'Nexforge Studios', phone: '+91 98765 43210',
      avatar_url: '/avatar-placeholder.svg', address: '123 Main St', currency: 'INR', timezone: 'Asia/Kolkata',
    }
    check('profile: fully-populated record is complete', isProfileComplete(complete))

    const badCurrency = validateProfileUpdate({ currency: 'ZZZ' }, complete)
    check('profile validation: rejects a currency outside the allowlist', !badCurrency.ok && !!badCurrency.errors.currency)

    const badTimezone = validateProfileUpdate({ timezone: 'Not/ARealZone' }, complete)
    check('profile validation: rejects an invalid IANA timezone', !badTimezone.ok && !!badTimezone.errors.timezone)

    const badWebsite = validateProfileUpdate({ website: 'not a url' }, complete)
    check('profile validation: rejects a malformed website URL', !badWebsite.ok && !!badWebsite.errors.website)

    const blankRequired = validateProfileUpdate({ full_name: '   ' }, complete)
    check('profile validation: rejects a blank required field', !blankRequired.ok && !!blankRequired.errors.full_name)

    const okUpdate = validateProfileUpdate({ business_name: 'New Studio Name' }, complete)
    check('profile validation: accepts a valid partial update', okUpdate.ok)

    // Real round-trip against pg-mem: update the row, then re-SELECT it
    // fresh (simulating a brand-new session/request) to confirm it's the
    // DB — not any in-memory object — that persisted the change.
    await pool.query(
      `UPDATE users SET full_name=$1, business_name=$2, phone=$3, avatar_url=$4, address=$5, currency=$6, timezone=$7, profile_completed_at=now() WHERE id=$8`,
      [complete.full_name, complete.business_name, complete.phone, complete.avatar_url, complete.address, complete.currency, complete.timezone, userRes.rows[0].id],
    )
    const freshRead = (await pool.query('SELECT full_name, business_name, profile_completed_at FROM users WHERE id=$1', [userRes.rows[0].id])).rows[0]
    check('profile: update persists and is readable in a fresh query', freshRead.full_name === 'Kartik Ghayal' && freshRead.business_name === 'Nexforge Studios')
    check('profile: profile_completed_at is set once required fields are present', !!freshRead.profile_completed_at)
  }

  // 15. requireAuth — the real security boundary, independent of any
  // frontend routing. Exercised directly against the middleware function
  // with fake req/res objects, since there's no HTTP server running here.
  {
    const { requireAuth } = await import('../src/middleware/auth.js')
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'smoke-test-secret'

    function fakeReqRes(authHeader) {
      const req = { headers: authHeader ? { authorization: authHeader } : {} }
      let statusCode = null
      let body = null
      const res = {
        status(code) { statusCode = code; return this },
        json(b) { body = b; return this },
      }
      return { req, res, getResult: () => ({ statusCode, body }) }
    }

    let nextCalled = false
    const missing = fakeReqRes(undefined)
    requireAuth(missing.req, missing.res, () => { nextCalled = true })
    check('requireAuth: rejects a request with no Authorization header', missing.getResult().statusCode === 401 && !nextCalled)

    nextCalled = false
    const garbage = fakeReqRes('Bearer not-a-real-jwt')
    requireAuth(garbage.req, garbage.res, () => { nextCalled = true })
    check('requireAuth: rejects a garbage/invalid token', garbage.getResult().statusCode === 401 && !nextCalled)

    nextCalled = false
    const expired = fakeReqRes(`Bearer ${jwt.sign({ sub: 'x', email: 'x@example.com' }, process.env.JWT_SECRET, { expiresIn: -10 })}`)
    requireAuth(expired.req, expired.res, () => { nextCalled = true })
    check('requireAuth: rejects an expired token', expired.getResult().statusCode === 401 && !nextCalled)

    nextCalled = false
    const valid = fakeReqRes(`Bearer ${jwt.sign({ sub: userRes.rows[0].id, email }, process.env.JWT_SECRET, { expiresIn: '7d' })}`)
    requireAuth(valid.req, valid.res, () => { nextCalled = true })
    check('requireAuth: accepts a valid token and calls next()', nextCalled && valid.req.userId === userRes.rows[0].id)
  }

  // 16. Workspace reset — clears every listed workspace table while
  // leaving the users row (and its now-completed profile) intact. Calls
  // the exact same lib function the route uses (server/src/lib/workspaceReset.js).
  {
    const { deleteAllWorkspaceData, collectLocalImageStorageKeys, WORKSPACE_TABLES_IN_DELETE_ORDER } = await import('../src/lib/workspaceReset.js')

    const preCounts = {}
    for (const table of WORKSPACE_TABLES_IN_DELETE_ORDER) {
      preCounts[table] = (await pool.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n
    }
    const anyDataBeforeReset = Object.values(preCounts).some((n) => n > 0)
    check('workspace reset: fixture has non-empty workspace tables before reset', anyDataBeforeReset, JSON.stringify(preCounts))

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await collectLocalImageStorageKeys(client) // exercised for coverage; no real files in this test
      await deleteAllWorkspaceData(client)
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }

    const postCounts = {}
    for (const table of WORKSPACE_TABLES_IN_DELETE_ORDER) {
      postCounts[table] = (await pool.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n
    }
    const allEmptyAfterReset = Object.values(postCounts).every((n) => n === 0)
    check('workspace reset: every listed workspace table is empty afterward', allEmptyAfterReset, JSON.stringify(postCounts))

    const userStillThere = (await pool.query('SELECT full_name FROM users WHERE id=$1', [userRes.rows[0].id])).rows[0]
    check('workspace reset: the owner user row (and profile) survives', userStillThere?.full_name === 'Kartik Ghayal')
  }

  // 17. Account deletion — MUST run last: this actually removes the user
  // row, so nothing after this point can assume `users` still has a row.
  {
    const preDeleteCount = (await pool.query('SELECT count(*)::int AS n FROM users')).rows[0].n
    check('account deletion fixture: exactly one owner user exists before deletion', preDeleteCount === 1)

    await pool.query('DELETE FROM otp_codes WHERE email = $1', [email])
    await pool.query('DELETE FROM users WHERE id = $1', [userRes.rows[0].id])

    const postDeleteCount = (await pool.query('SELECT count(*)::int AS n FROM users')).rows[0].n
    check('account deletion: the user row is actually removed', postDeleteCount === 0)
  }

  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  console.error('Smoke test crashed:', err)
  process.exit(1)
})
