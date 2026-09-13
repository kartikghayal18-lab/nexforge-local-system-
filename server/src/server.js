import 'dotenv/config'
import { createApp } from './app.js'
import { runMigrations } from '../db/migrate.js'

const port = process.env.PORT || 4000

if (!process.env.DATABASE_URL) {
  console.error('[server] DATABASE_URL is not set. The server will start but every DB-backed route will fail.')
}
if (!process.env.JWT_SECRET) {
  console.error('[server] JWT_SECRET is not set. Auth routes will fail to sign/verify tokens.')
}

async function start() {
  // Apply any pending schema/migrations against DATABASE_URL before
  // accepting traffic. This is what makes a Render deploy self-healing for
  // schema drift — a migration file added to server/db/migrations/ is
  // guaranteed to run against the real (e.g. Neon) database on the very
  // next deploy, instead of relying on someone remembering to run
  // `npm run migrate` by hand. Every statement involved is idempotent, so
  // this is safe to run on every single boot, including local dev.
  if (process.env.DATABASE_URL) {
    try {
      await runMigrations()
      console.log('[server] database schema is up to date')
    } catch (err) {
      // Fail loudly and refuse to serve traffic against a schema the code
      // doesn't match — a half-migrated DB causes far more confusing
      // "column does not exist" errors later than a clear boot-time crash
      // now (Render will show this in the deploy logs and can be retried).
      console.error('[server] failed to apply database migrations:', err.message)
      process.exit(1)
    }
  }

  const app = createApp()
  app.listen(port, () => {
    console.log(`Nexforge API listening on :${port}`)
  })
}

start()
