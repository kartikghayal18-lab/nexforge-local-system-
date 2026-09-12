# Architecture (Phase 4 — Web)

```
┌──────────────┐      HTTPS + JWT       ┌───────────────────┐
│   Frontend   │ ─────────────────────▶ │   Express API      │
│  React+Vite  │ ◀───────────────────── │   (Render)          │
│  (Vercel)    │        JSON            │  server/src/*.js     │
└──────┬───────┘                        └─────────┬────────────┘
       │                                            │ pg (parameterized SQL)
       │ presigned PUT/GET (direct browser↔R2)      ▼
       │                                    ┌──────────────────┐
       ▼                                    │ PostgreSQL (Neon)│
┌──────────────┐                            └──────────────────┘
│ Cloudflare R2│
│ (file bytes) │
└──────────────┘
```

- **Frontend**: unchanged React UI (`src/pages`, `src/components`), same
  Tailwind design. Only the data layer changed: `src/data/coreClient.ts` and
  `src/vault/tauriClient.ts` now call `fetch()` against
  `VITE_API_BASE_URL` with a `Bearer` JWT, instead of Tauri `invoke()`. A new
  `src/auth/AuthContext.tsx` + `src/pages/Login.tsx` + `ProtectedRoute` in
  `App.tsx` gate the whole app behind sign-in.
- **Backend**: Express (`server/src/app.js`), organized by resource under
  `server/src/routes/`. All routes except `/api/auth/*` require a valid JWT
  (`server/src/middleware/auth.js`).
- **Database**: PostgreSQL on Neon. Access via `pg` with parameterized
  queries only (`server/src/db/pool.js`). Schema in `server/db/schema.sql`.
- **File storage (generic project files)**: Cloudflare R2 (S3-compatible).
  The backend never proxies file bytes — it hands the frontend short-lived
  presigned PUT/GET URLs (`server/src/lib/r2.js`,
  `server/src/routes/files.js`); the browser talks to R2 directly.
- **File storage (project cover/gallery images)**: a separate, swappable
  path — the backend *does* proxy these bytes, deliberately. The frontend
  POSTs a multipart file straight to the Express backend
  (`POST /api/projects/:id/images`), which validates it (MIME type + magic
  bytes + 5MB cap — `server/src/lib/storage/index.js`) and hands the buffer
  to a small storage abstraction (`server/src/lib/storage/`). Today's
  implementation (`localDisk.js`) writes to this backend's own disk under
  `server/public/images/projects/` and serves it back via `express.static`
  — this is the *Express backend's* `public/`, not the Vite frontend's, and
  it never touches Vercel's (ephemeral) runtime filesystem. Only the
  resulting URL + a storage key are stored in Postgres (`project_images`
  table) — never binary or base64. See `docs/DEPLOYMENT.md` for the
  important caveat: this only survives redeploys if Render's disk for this
  service has a Persistent Disk attached; swapping the one import in
  `server/src/lib/storage/index.js` to an `s3.js` implementation (reusing
  the R2 client above) removes that caveat without touching routes or the
  DB schema.
- **PDF generation**: `pdfkit`, server-side, streamed from
  `GET /api/invoices/:id/pdf` (`server/src/lib/pdf.js`) — a real generated
  PDF, not a screenshot or client-side print.
- **Auth**: bcrypt password hashing + JWT (7-day expiry). Single-owner:
  `/api/auth/register` refuses once a user exists.
- **Vault encryption**: AES-256-GCM, server-side key
  (`ENCRYPTION_KEY`) — see `docs/VAULT_SECURITY.md`.

## What was discontinued

The Tauri/Rust desktop app (`src-tauri/`) is no longer part of the deployed
product. The directory is left on disk in case of a future return to it, but
the frontend build and deploy do not depend on it in any way — see
`CHANGELOG.md` "Phase 4 — Web migration" for the full rationale.
