import pg from 'pg'
import 'dotenv/config'

const { Pool } = pg

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  // Fail loudly at import time with a clear message rather than a cryptic
  // ECONNREFUSED deep in a query later.
  console.error('[db] DATABASE_URL is not set. Set it in server/.env (see server/.env.example).')
}

export const pool = new Pool({
  connectionString,
  ssl: connectionString && connectionString.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
  max: 10,
  idleTimeoutMillis: 30000,
})

pool.on('error', (err) => {
  console.error('[db] Unexpected error on idle client', err)
})

export async function query(text, params) {
  return pool.query(text, params)
}
