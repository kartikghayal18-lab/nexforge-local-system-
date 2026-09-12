import 'dotenv/config'
import { createApp } from './app.js'

const port = process.env.PORT || 4000

if (!process.env.DATABASE_URL) {
  console.error('[server] DATABASE_URL is not set. The server will start but every DB-backed route will fail.')
}
if (!process.env.JWT_SECRET) {
  console.error('[server] JWT_SECRET is not set. Auth routes will fail to sign/verify tokens.')
}

const app = createApp()
app.listen(port, () => {
  console.log(`Nexforge API listening on :${port}`)
})
