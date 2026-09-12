# Changelog

## Phase 5 — Project cover + gallery images
- Added `project_images` table (`db/migrations/001_project_images.sql`):
  cover + gallery images per project, metadata only (`url`, `storage_key`,
  `is_cover`, `file_name`, `file_size`, `mime_type`) — no binary/base64 in
  Postgres, matching the existing `project_files` pattern.
- New backend routes under `/api/projects/:id/images` (list, multipart
  upload, set-cover, delete), server-side validated regardless of the
  client (MIME type + magic bytes + 5MB cap — `server/src/lib/storage/index.js`).
- New storage abstraction (`server/src/lib/storage/`) with a swappable
  backend: `localDisk.js` today, a documented drop-in path to
  `s3.js` (reusing the existing R2 client) later — one import line to change,
  no route or schema changes.
- Frontend: cover image preview/replace and a gallery grid (upload, delete,
  set-as-cover) added to the Project Details page, with a placeholder icon
  when no image is set. Client-side type/size validation for fast feedback;
  the server is the real gate.
- **Known limitation**: images are written to the Express backend's own
  local disk (`server/public/images/projects/`), not to Cloudflare R2. A
  standard Render web service's disk is wiped on redeploy unless a paid
  Persistent Disk add-on is attached — until then, uploaded project images
  are not durable across deploys. See `docs/DEPLOYMENT.md`.

## Phase 1 — Initial build
UI shell built from scratch: React + TypeScript + Vite + Tailwind + React
Router + lucide-react. Sidebar navigation, Dashboard, Projects, Invoices
(full builder + live preview + print layout), placeholder Secrets/
Passwords/Files pages, `localStorage`-backed data via `useStore.ts` hooks
with seeded demo data.

## Phase 2 — Secure vault
Replaced the placeholder Secrets/Passwords pages with a real Tauri 2 +
Rust + SQLite encrypted vault: Argon2id key derivation, AES-256-GCM field
encryption, master-password verifier pattern, global + per-project secret/
password/database-credential management, `.env` import/export, encrypted
`.nexforgevault` backup/restore, configurable auto-lock, browser-vs-desktop
mode gating (`isDesktop()`).

## Phase 3 — Real business-data persistence (this body of work)
- Extended the SQLite schema (`db.rs`) with `clients`, `invoices`,
  `invoice_items`, `payments`, `project_notes`, `project_files`,
  `settings`, plus new columns on `projects`, via an idempotent
  column-migration helper.
- Added `core.rs`: full CRUD Tauri commands for clients, projects, project
  links/notes/files (with on-disk storage under the app-data directory),
  settings, invoices (with sequential numbering and computed totals), and
  payments (with automatic invoice status advancement), plus a
  `dashboard_stats` aggregate command.
- Wrote `src/data/coreClient.ts` / `coreTypes.ts` and rewired Projects,
  Clients, Project Details (Overview/Notes/Links/Files tabs), Invoices
  (list/editor/view/payments), Dashboard, Settings (business profile), and
  Global Search to call these commands in desktop mode, with a "demo data"
  fallback banner in browser mode — no visual redesign.
- Added real Rust-side PDF generation (`pdf.rs`, using `printpdf` + the
  `image` crate for an optional business logo) and wired a native
  "Export PDF" save-dialog button into the invoice view, alongside the
  pre-existing browser-print button.
- Extended `backup.rs` to include clients, invoices, invoice_items,
  payments, project_notes, project_links, the `settings` table, and
  project file attachments (embedded as base64, restored to disk).
- Added business-logo upload to Settings (stored as base64 in `settings`,
  consumed by the PDF).
- Fixed a real build bug: `tsconfig.node.json` had no `outDir`, so
  `tsc -b` was emitting stray `vite.config.js`/`.d.ts` files into the repo
  root on every build; added a scoped `outDir` and removed the stray
  files.
- Wrote this `docs/` folder.

## Remaining limitations (as of this changelog entry)
- **No Rust toolchain has been available in this development
  environment**, so none of the Rust code above — the schema, the new
  commands, the PDF generation, the extended backup — has been compiled
  or run. `npm run build` (frontend/TypeScript only) passes with zero
  errors; that is the only automated verification performed so far. See
  docs/TESTING.md for the manual checklist to run once Rust is installed
  and `cargo check`/`cargo build`/`npm run tauri:dev` succeed.
- The `printpdf`/`image` crate API usage in `pdf.rs` was written from
  memory without a compiler to check it against, and is the single most
  likely place to need a fix once actually compiled.
- Payment/bank-detail fields on the Settings page remain
  `localStorage`-only (non-sensitive display text), not yet moved into
  the SQLite `settings` table.
- `project_id`/`client_id`/`invoice_id` relationships are enforced in
  application code, not SQL foreign keys (see docs/DATABASE.md for why).
- No email-sending feature exists (docs/EMAIL_SETUP.md documents this as
  a future placeholder, not a current gap being tracked for this pass).

## Phase 4 — Web migration (2026-09-12)

Owner decision: stop the Tauri/Rust desktop app entirely and rebuild as a
deployable web app. Rationale: the Rust backend never reached a compiling
state in earlier phases (no Rust toolchain was ever available to verify it),
and a hosted web app is more useful day-to-day than a desktop-only tool.

- **Discontinued**: `src-tauri/` (Rust/SQLite backend). Left on disk, not
  deleted, in case of a future return to it — but it is no longer part of
  the build or deploy path for this app.
- **New backend**: `server/` — Node.js + Express, PostgreSQL (Neon) via
  `pg` with parameterized queries, JWT auth (`jsonwebtoken`) + bcrypt
  password hashing, AES-256-GCM vault encryption (server-side key, see
  `docs/VAULT_SECURITY.md`), file storage moved to Cloudflare R2
  (presigned PUT/GET, `@aws-sdk/client-s3`), invoice PDF generation moved
  to `pdfkit` (Node) from the old Rust `printpdf`.
- **Frontend**: same React components, same Tailwind UI, same routes.
  `src/data/coreClient.ts` and `src/vault/tauriClient.ts` rewritten to call
  the Express API over `fetch()` instead of Tauri `invoke()`. Added
  `src/auth/AuthContext.tsx`, `src/pages/Login.tsx`, and a `ProtectedRoute`
  wrapper in `App.tsx` — the only genuinely new UI in this phase. Removed
  the desktop-vs-browser "Demo data" distinction; `isDesktop()` is now a
  compatibility alias for "is a session token present".
- **Target deploy**: React+Vite on Vercel, Express on Render, Postgres on
  Neon, files on Cloudflare R2. See `docs/DEPLOYMENT.md`.
- **Testing performed**: `npm run build` (frontend) — zero TypeScript
  errors. A `pg-mem` (in-memory Postgres emulator) smoke test exercising
  register → login → create client → create project → create invoice →
  add payment → dashboard stats, plus a vault encrypt/decrypt round-trip —
  11/11 checks passed (`server/scripts/smoke-test.js`). Confirmed the
  Express server starts and returns a clean 500 (not a crash) when
  `DATABASE_URL` is unreachable.
- **Not verified** (no credentials/network for these in this environment):
  a real Neon Postgres, a real Cloudflare R2 bucket, an actual Render
  deployment, an actual Vercel deployment. See `docs/DEPLOYMENT.md` for
  what the owner still needs to do and verify by hand.
- **Known gaps carried over from the desktop app, still open**: the old
  vault backup/export/import and "migrate local projects" features have no
  web equivalent yet — the vault UI still shows those buttons; they now
  fail with an explicit "not available in the web version yet" error
  instead of a broken Tauri call. `docs/VAULT_SECURITY.md` covers the new
  encryption model in full.
