# Deployment

## 1. Database — Neon

1. Create a project at neon.tech, create a database, and copy its
   connection string (with `?sslmode=require`) as `DATABASE_URL`.
2. Migrations are applied automatically. `server/src/server.js` runs
   `runMigrations()` (from `server/db/migrate.js`) once at process startup,
   before it starts accepting traffic — so every deploy on Render
   automatically applies `server/db/schema.sql` plus any new file added to
   `server/db/migrations/*.sql` against the real `DATABASE_URL`, with no
   manual step to remember. Every statement is idempotent
   (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, etc.) and
   applied migrations are tracked in a `schema_migrations` table, so it's
   safe to boot the server any number of times, including against a
   database that's already fully up to date.
   If the migration step fails (e.g. `DATABASE_URL` unreachable or wrong),
   the server logs a clear `[server] failed to apply database migrations: ...`
   line and exits — it will never silently serve traffic against a
   mismatched schema. Check Render's deploy logs for this line if the API
   returns 500s after a deploy.
3. You can still run it by hand from any machine with network access to
   Neon (useful the first time, or to pre-apply a migration before
   deploying):
   ```bash
   cd server
   cp .env.example .env   # paste in DATABASE_URL
   npm install
   npm run migrate
   ```

## 2. File storage — Cloudinary

See `docs/CLOUDINARY_SETUP.md` for full steps. In short: create a free
Cloudinary account and copy its cloud name, API key and API secret into
`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
Cloudinary powers project cover/gallery images, project files/documents,
and the business logo — all uploads go straight from this backend to
Cloudinary (no local disk, no separate S3-compatible bucket). Missing
credentials fail the server's boot loudly (see `server/src/lib/cloudinary.js`),
the same way a missing `ENCRYPTION_KEY` does.

## 3. Backend — Render

1. New Web Service → connect the repo → root directory `server/`.
2. Build command: `npm install`. Start command: `npm start`.
3. Set environment variables (Render dashboard → Environment): `DATABASE_URL`,
   `JWT_SECRET`, `ENCRYPTION_KEY`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`,
   `CLOUDINARY_API_SECRET`, `CORS_ORIGIN` (set this after
   step 4, once you know the Vercel URL — or set it to `*` temporarily and
   tighten it after). Optionally `IMAGE_MAX_SIZE_MB` (default `5`) and
   `FILE_MAX_SIZE_MB` (default `20`).
4. Deploy. Confirm `GET https://<render-url>/api/health` returns `{"ok":true}`.

### Project images — production uploads are disabled until real storage is configured

Project cover/gallery images can be added two ways:

1. **Project images** (`POST /api/projects/:id/images`, multipart) —
   validated server-side (MIME type + magic bytes + size cap) and uploaded
   to Cloudinary via the storage abstraction (`server/src/lib/storage/`).
2. **Static path** (`POST /api/projects/:id/images/static`) — just records a
   URL/path string, no bytes involved. Still useful for a URL you already
   have (e.g. a logo hosted elsewhere).
3. **Project files/documents** (`POST /api/files/project/:projectId`,
   multipart) — validated (MIME/extension/magic bytes + size cap) and
   uploaded to Cloudinary directly (`server/src/routes/files.js`).
4. **Business logo** (`POST /api/settings/logo`, multipart) — same
   validation as project images, uploaded to Cloudinary, replacing any
   previous logo.

Cloudinary works identically in development and production once
`CLOUDINARY_CLOUD_NAME`/`CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET` are
set — there is no local-disk fallback and no production gate: a missing
credential fails the server's boot (see step 3 above and
`server/src/lib/cloudinary.js`), never a per-upload 503. Deleting a row
(image, file, logo) also destroys the underlying Cloudinary asset; a
Cloudinary-side delete failure is logged, not thrown, so the DB row is
still removable if the remote asset is already gone.

## 4. Frontend — Vercel

1. New Project → import the repo → root directory (repo root, not `server/`).
2. Framework preset: Vite. Build command `npm run build`, output dir `dist`.
3. Environment variable: `VITE_API_BASE_URL` = the Render URL from step 3.
4. Deploy. Once you have the Vercel URL, go back to Render and set
   `CORS_ORIGIN` to that exact origin (no trailing slash), then redeploy the
   backend so CORS reflects it.

## 5. Email OTP login (Resend)

Sign-in supports emailed one-time codes in addition to password login:
`POST /api/auth/send-otp` emails a 6-digit code (via Resend,
`server/src/lib/email.js`) and `POST /api/auth/verify-otp` checks it and
logs the user in — creating the single owner account on the very first
successful verification if none exists yet, same rule as `/register`. The
Resend API key and sender are backend-only env vars
(`RESEND_API_KEY`, `RESEND_FROM_EMAIL`) — never exposed to the frontend.
`RESEND_FROM_EMAIL` must be an address on a domain verified in Resend's
dashboard, or sends will fail.

## 6. First login

Visit the deployed frontend and either enter your email to receive a
sign-in code (OTP), or click "Create the owner account" to register with a
password — whichever completes first creates the single owner account.
Both paths are permanently locked after that first account is created:
`POST /api/auth/register` returns 403 once a user exists, and
`POST /api/auth/verify-otp` returns "No account exists for this email" for
any other address once a user exists — this is a single-owner app, not a
public signup form.

## What's verified vs. not

Everything above was written against the real Neon/Cloudinary/Render/Vercel
APIs and matches how each service documents itself, but **none of it has
been exercised against live infrastructure from this environment** — there
is no reachable Postgres, Cloudinary, Render, or Vercel account here. What
has been verified locally: `npm run build` (frontend, zero TS errors), the Express
app boots and fails DB queries gracefully instead of crashing, and a
pg-mem-based smoke test of the schema + core route logic (see `TESTING.md`).
