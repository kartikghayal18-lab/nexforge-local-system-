// Idempotent schema/migration runner.
//
// Safe to run any number of times against any environment (empty DB, DB
// already fully up to date, or DB stuck partway through). It:
//   1. Applies server/db/schema.sql, which is itself fully idempotent
//      (CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS throughout).
//   2. Applies every file in server/db/migrations/*.sql, in filename order,
//      skipping any migration already recorded in schema_migrations.
//
// Can be run two ways:
//   - `npm run migrate` (node db/migrate.js) — manual/CI invocation.
//   - Imported as `runMigrations()` and called from server.js at process
//     startup, so a deploy can never again "forget" to apply pending
//     migrations against the real database (see server/src/server.js).
import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const { Pool } = pg

function makePool() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is not set')
  return new Pool({
    connectionString,
    ssl: connectionString.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
  })
}

export async function runMigrations(existingPool) {
  const pool = existingPool || makePool()
  const client = await pool.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)

    // Base schema first — every statement in schema.sql is idempotent
    // (IF NOT EXISTS), so re-running it against an already-current database
    // is always a safe no-op.
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')
    await client.query(schemaSql)

    const migrationsDir = path.join(__dirname, 'migrations')
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort()

    const { rows: appliedRows } = await client.query('SELECT id FROM schema_migrations')
    const applied = new Set(appliedRows.map((r) => r.id))

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`[migrate] ${file} already applied, skipping`)
        continue
      }
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
      console.log(`[migrate] applying ${file}`)
      try {
        await client.query('BEGIN')
        await client.query(sql)
        await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [file])
        await client.query('COMMIT')
      } catch (err) {
        await client.query('ROLLBACK')
        throw new Error(`[migrate] ${file} failed: ${err.message}`)
      }
    }

    console.log('[migrate] database schema is up to date')
  } finally {
    client.release()
    if (!existingPool) await pool.end()
  }
}

// `node db/migrate.js` — manual/CI entry point. Comparing resolved paths
// (rather than a raw string/URL equality check, which is fragile across
// platforms and symlinked paths) so this reliably fires only when the file
// is executed directly, never when it's imported (e.g. by server.js).
const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[migrate] failed:', err.message)
      process.exit(1)
    })
}
