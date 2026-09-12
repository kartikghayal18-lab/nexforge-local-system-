// Applies server/db/schema.sql against process.env.DATABASE_URL.
// Idempotent: every statement uses CREATE TABLE/INDEX IF NOT EXISTS, so this
// is safe to re-run. For real schema evolution later, add numbered files
// under server/db/migrations/ and extend this script to apply them in order
// (tracked in a `schema_migrations` table) — not needed yet for a fresh DB.
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import 'dotenv/config'

const { Pool } = pg
const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error('DATABASE_URL is not set. Copy server/.env.example to server/.env and fill it in.')
    process.exit(1)
  }

  const pool = new Pool({ connectionString, ssl: connectionString.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined })
  const client = await pool.connect()
  try {
    const schema = readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')
    console.log('Applying server/db/schema.sql ...')
    await client.query(schema)
    console.log('Base schema applied.')

    const migrationsDir = path.join(__dirname, 'migrations')
    let files = []
    try {
      files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()
    } catch {
      files = []
    }
    for (const file of files) {
      console.log(`Applying migration ${file} ...`)
      const sql = readFileSync(path.join(migrationsDir, file), 'utf8')
      await client.query(sql)
    }
    console.log('Done.')
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
