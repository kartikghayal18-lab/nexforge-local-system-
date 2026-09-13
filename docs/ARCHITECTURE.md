# Architecture (Phase 4 — Web)

```
┌──────────────┐      HTTPS + JWT       ┌───────────────────┐
│   Frontend   │ ─────────────────────▶ │   Express API      │
│  React+Vite  │ ◀───────────────────── │   (Render)          │
│  (Vercel)    │        JSON            │  server/src/*.js     │
└──────────────┘                        └─────────┬────────────┘
                                                    │ pg (parameterized SQL)
                        ┌───────────────────────────┼──────────────────┐
                        ▼                            ▼                  │
                ┌──────────────────┐        ┌──────────────────┐        │
                │ PostgreSQL (Neon)│        │    Cloudinary    │        │
                └──────────────────┘        │  (file bytes)    │        │
                                             └──────────────────┘◀──────┘
```
The backend proxies every upload — it validates the buffer, then hands it
to Cloudinary via the Node SDK. The browser never talks to Cloudinary
directly (no presigned URLs, no bucket CORS to configure).

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
- **File storage (all of it — project cover/gallery images, project
  files/documents, business logo)**: Cloudinary. The frontend POSTs a
  multipart file straight to the Express backend, which validates it
  (MIME type + extension + magic-byte sniffing + size cap —
  `server/src/lib/storage/index.js` for images,
  `server/src/lib/storage/fileValidation.js` for generic files) and hands
  the buffer to `server/src/lib/cloudinary.js`
  (`cloudinary.uploader.upload_stream`). Only the resulting `secure_url` +
  Cloudinary `public_id` (stored in the `storage_key` column) are kept in
  Postgres — never binary or base64. Durable identically in development
  and production, no local-disk fallback, no bucket to configure. See
  `docs/CLOUDINARY_SETUP.md`.
- **PDF generation**: `pdfkit`, server-side, streamed from
  `GET /api/invoices/:id/pdf` (`server/src/lib/pdf.js`) — a real generated
  PDF, not a screenshot or client-side print.
- **Auth**: two ways to sign in, both single-owner:
  - Password: bcrypt password hashing + JWT (7-day expiry).
    `/api/auth/register` refuses once a user exists.
  - Email OTP (`server/src/routes/auth.js` `/send-otp` + `/verify-otp`,
    `server/src/lib/otp.js`, `server/src/lib/email.js`): a 6-digit code
    (`crypto.randomInt`, never `Math.random()`) is emailed via Resend, only
    its bcrypt hash is stored (`otp_codes` table, `db/migrations/002_otp_codes.sql`),
    it expires after 10 minutes, is single-use (consumed on verify), and
    sending is rate-limited per email (60s cooldown + 5/hour, both computed
    from `otp_codes.created_at`). `/send-otp` never reveals whether the
    email belongs to a user; `/verify-otp` creates the single owner account
    on first successful verification only if `users` is still empty
    (mirroring `/register`'s 403-after-first-user rule) and otherwise logs
    the existing user in. Both login paths call the same `signToken()`
    helper, so `AuthContext`/`requireAuth` don't know or care which method
    was used.
- **Vault encryption**: AES-256-GCM, server-side key
  (`ENCRYPTION_KEY`) — see `docs/VAULT_SECURITY.md`.

## What was discontinued

The Tauri/Rust desktop app (`src-tauri/`) is no longer part of the deployed
product. The directory is left on disk in case of a future return to it, but
the frontend build and deploy do not depend on it in any way — see
`CHANGELOG.md` "Phase 4 — Web migration" for the full rationale.
