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

  // Centralized error handler — never leak stack traces to clients.
  app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    // Multer (image upload) errors — e.g. file too large — should read as a
    // normal 400 validation error, not a 500.
    if (err && err.name === 'MulterError') {
      const message = err.code === 'LIMIT_FILE_SIZE' ? 'Image is too large' : err.message
      return res.status(400).json({ error: message })
    }
    console.error('[api] unhandled error:', err)
    res.status(500).json({ error: 'Internal server error' })
  })

  return app
}
