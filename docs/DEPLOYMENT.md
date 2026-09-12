# Deployment

## 1. Database — Neon

1. Create a project at neon.tech, create a database, and copy its
   connection string (with `?sslmode=require`) as `DATABASE_URL`.
2. Locally (or from any machine with network access to Neon):
   ```bash
   cd server
   cp .env.example .env   # paste in DATABASE_URL
   npm install
   npm run migrate
   ```
   This applies `server/db/schema.sql`.

## 2. File storage — Cloudflare R2

See `docs/R2_SETUP.md` for full steps. In short: create a bucket, an API
token scoped to it, and set CORS on the bucket so the browser can PUT
directly to it from your Vercel origin.

## 3. Backend — Render

1. New Web Service → connect the repo → root directory `server/`.
2. Build command: `npm install`. Start command: `npm start`.
3. Set environment variables (Render dashboard → Environment): `DATABASE_URL`,
   `JWT_SECRET`, `ENCRYPTION_KEY`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
   `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `CORS_ORIGIN` (set this after
   step 4, once you know the Vercel URL — or set it to `*` temporarily and
   tighten it after). Optionally `IMAGE_MAX_SIZE_MB` (default `5`) and
   `STORAGE_BACKEND` (leave unset / `local-dev` until R2/S3 is wired up for
   project images — see below).
4. Deploy. Confirm `GET https://<render-url>/api/health` returns `{"ok":true}`.

### Project images — production uploads are disabled until real storage is configured

Project cover/gallery images can be added two ways:

1. **Upload** (`POST /api/projects/:id/images`, multipart) — validated
   server-side (MIME type + magic bytes + 5MB cap) and handed to the storage
   abstraction (`server/src/lib/storage/`).
2. **Static path** (`POST /api/projects/:id/images/static`) — just records a
   URL/path string, no bytes involved. See "Recommended way to get images
   into the live app" below.

**The storage abstraction is gated by two env vars working together:**
`NODE_ENV` and `STORAGE_BACKEND`. `STORAGE_BACKEND` defaults to `local-dev`
if unset — the safe, honest default that ships with this app. When
`NODE_ENV=production` **and** `STORAGE_BACKEND` is still `local-dev` (i.e.
nobody has wired up real cloud storage), `saveImage()` refuses the upload
with a `StorageNotConfiguredError`, and the upload route turns that into an
HTTP 503 with a clear message — instead of silently writing to Render's
disk and pretending it's permanent.

- **In local development** (`NODE_ENV` not `production`), uploads still
  write to this backend's own local disk exactly as before
  (`server/public/images/projects/...`, served via `express.static`) — this
  is genuinely useful for developing and testing the feature and is left
  working unchanged.
- **In production on Render, by default** (`STORAGE_BACKEND` unset ⇒
  `local-dev`), the upload endpoint is intentionally disabled and returns a
  503 explaining why. This is deliberate: Render's disk for a standard web
  service is ephemeral (wiped on redeploy) unless you attach the paid
  **Persistent Disk** add-on, and this app does not want to accept uploads
  it can silently lose.
- **Recommended way to get images into the live app for now**: commit image
  files under the Vite frontend's own `public/images/projects/` folder (a
  normal static asset, built and deployed by Vercel like any other file in
  `public/`), then use the "paste an image path/URL" field in the Project
  Details page's Images section (or call
  `POST /api/projects/:id/images/static` directly) with a path like
  `/images/projects/my-project.png`. This records the URL in the
  `project_images` table with no backend-managed file at all — it's
  reliable today, with zero extra infrastructure.
- **The eventual real fix — R2/S3**: this project already talks to
  Cloudflare R2 for generic project files (`server/src/lib/r2.js`, used by
  `server/src/routes/files.js`) — R2 storage is already provisioned and paid
  for in this app. To enable real persistent uploads: implement
  `server/src/lib/storage/s3.js` exporting the same `saveImage`/
  `deleteImage` interface as `server/src/lib/storage/localDisk.js` (it can
  reuse `server/src/lib/r2.js`'s client), change the one import line in
  `server/src/lib/storage/index.js` from `./localDisk.js` to `./s3.js`, and
  set `STORAGE_BACKEND=s3` (or `r2`) in Render's environment variables. No
  route code, no DB schema, and no frontend code needs to change — the
  `project_images` table already stores a generic `url` + `storage_key`
  regardless of where the bytes actually live, and the 503 gate above stops
  applying automatically once `STORAGE_BACKEND` is no longer `local-dev`.

## What's verified vs. not

Everything above was written against the real Neon/R2/Render/Vercel APIs and
matches how each service documents itself, but **none of it has been
exercised against live infrastructure from this environment** — there is no
reachable Postgres, R2, Render, or Vercel account here. What has been
verified locally: `npm run build` (frontend, zero TS errors), the Express
app boots and fails DB queries gracefully instead of crashing, and a
pg-mem-based smoke test of the schema + core route logic (see `TESTING.md`).
