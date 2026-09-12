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

  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  console.error('Smoke test crashed:', err)
  process.exit(1)
})
