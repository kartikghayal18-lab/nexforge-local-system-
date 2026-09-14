import express from 'express'
import cors from 'cors'
import path from 'node:path'
import 'express-async-errors' // patches Express to forward async route rejections to the error handler
import { requireAuth } from './middleware/auth.js'

import authRoutes from './routes/auth.js'
import clientsRoutes from './routes/clients.js'
import projectsRoutes from './routes/projects.js'
import invoicesRoutes from './routes/invoices.js'
import paymentsRoutes from './routes/payments.js'
import settingsRoutes from './routes/settings.js'
import vaultRoutes from './routes/vault.js'
import filesRoutes from './routes/files.js'
import dashboardRoutes from './routes/dashboard.js'
import profileRoutes from './routes/profile.js'
import workspaceRoutes from './routes/workspace.js'
import accountRoutes from './routes/account.js'

export function createApp() {
  const app = express()

  app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }))
  app.use(express.json({ limit: '2mb' }))

  // Serves files written by server/src/lib/storage/localDisk.js
  // (server/public/images/projects/...) at GET /images/projects/....
  // This is the Express backend's own local disk — NOT the Vite frontend's
  // public/ folder and NOT anything Vercel touches. See docs/DEPLOYMENT.md.
  app.use('/images', express.static(path.join(process.cwd(), 'public', 'images')))

  app.get('/api/health', (req, res) => res.json({ ok: true }))

  app.use('/api/auth', authRoutes)

  // Everything below requires a valid JWT.
  app.use('/api/clients', requireAuth, clientsRoutes)
  app.use('/api/projects', requireAuth, projectsRoutes)
  app.use('/api/invoices', requireAuth, invoicesRoutes)
  app.use('/api/payments', requireAuth, paymentsRoutes)
  app.use('/api/settings', requireAuth, settingsRoutes)
  app.use('/api/vault', requireAuth, vaultRoutes)
  app.use('/api/files', requireAuth, filesRoutes)
  app.use('/api/dashboard', requireAuth, dashboardRoutes)
  app.use('/api/profile', requireAuth, profileRoutes)
  app.use('/api/workspace', requireAuth, workspaceRoutes)
  app.use('/api/account', requireAuth, accountRoutes)

  // Centralized error handler — never leak stack traces to clients.
  app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    // Multer (image/file upload) errors — e.g. file too large — should
    // read as a normal 400 validation error, not a 500.
    if (err && err.name === 'MulterError') {
      const message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large' : err.message
      return res.status(400).json({ error: message })
    }
    // Cloudinary SDK errors carry an http_code (e.g. 400 invalid image,
    // 401 bad credentials, 420 rate limited) — surface those as a clean
    // 400/502 JSON response instead of a generic 500. A client-shaped
    // failure (bad file, invalid params) maps to 400; anything else
    // (auth/rate-limit/upstream trouble) maps to 502 since it's this
    // server's Cloudinary config or Cloudinary itself, not the caller.
    if (err && typeof err.http_code === 'number') {
      const status = err.http_code >= 400 && err.http_code < 500 ? 400 : 502
      console.error('[api] Cloudinary error:', err.http_code, err.message)
      const clientMessage = status === 400
        ? 'Image upload failed: the file was rejected. Please try a different file.'
        : 'Image upload failed. Please try again, or contact support if this persists.'
      return res.status(status).json({ error: clientMessage })
    }
    console.error('[api] unhandled error:', err)
    res.status(500).json({ error: 'Internal server error' })
  })

  return app
}
