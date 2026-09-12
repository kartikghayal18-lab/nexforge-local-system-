# Nexforge Studio Manager

A personal studio-management app: projects, clients, invoices, payments,
project files, and an encrypted secrets vault (API keys, passwords, database
credentials). Now a **deployed web app** — React+Vite frontend on Vercel,
Node/Express API on Render, PostgreSQL on Neon, file storage on Cloudflare
R2. See `docs/CHANGELOG.md` ("Phase 4 — Web migration") for why and what
changed; the earlier desktop/Tauri phase is discontinued but its history is
preserved there, not deleted.

## Main features

- **Projects** — status, client link, tech stack, links (repo/live/
  staging), budget/dates, notes, files, and per-project credentials.
- **Clients** — contact records, linked projects and invoices.
- **Invoices** — line items, discount, tax, sequential numbering
  (`PREFIX-YEAR-NNN`, computed server-side), status tracking, payment
  recording with automatic balance/status updates, and a real
  server-generated PDF export (`pdfkit`), not a screenshot or browser print.
- **Secure Vault** — AES-256-GCM server-side encryption for secrets,
  passwords, and database credentials, global or per-project — see
  `docs/VAULT_SECURITY.md` for the design.
- **File attachments** — upload/download/delete files per project, stored
  in Cloudflare R2 via presigned URLs (bytes never pass through the API
  server).
- **Dashboard** — real counts and totals from Postgres.
- **Auth** — single-owner account, JWT + bcrypt (`src/auth/AuthContext.tsx`,
  `src/pages/Login.tsx`).

## Tech stack

- **Frontend**: React 18 + TypeScript + Vite 5 + Tailwind CSS +
  lucide-react + React Router. Deployed to Vercel.
- **Backend**: Node.js + Express (`server/`). Deployed to Render.
- **Database**: PostgreSQL (Neon), accessed via `pg` with parameterized
  queries only. Schema: `server/db/schema.sql`.
- **File storage**: Cloudflare R2 (S3-compatible), via
  `@aws-sdk/client-s3` + presigned URLs.
- **Auth**: `bcrypt` password hashing + `jsonwebtoken` (7-day expiry).
- **Vault crypto**: AES-256-GCM, server-side key.
- **PDF generation**: `pdfkit`.

## Repository layout

```
src/                  React frontend (unchanged UI from the desktop phase)
  pages/, components/ Route-level pages and shared UI, unchanged
  auth/                AuthContext.tsx — new: JWT session state
  data/                coreClient.ts — REST client (was a Tauri invoke() wrapper)
  vault/               tauriClient.ts — REST client for the vault (same, rewritten)
server/               Express API (new)
  db/                  schema.sql, migrate.js, migrations/
  src/
    app.js, server.js  Express app + entrypoint
    db/pool.js          pg Pool
    middleware/auth.js  JWT verification
    routes/             one file per resource
    lib/                crypto.js (AES-256-GCM), r2.js, pdf.js, invoiceNumber.js
  scripts/smoke-test.js pg-mem based smoke test (see docs/TESTING.md)
src-tauri/            Discontinued Rust/Tauri desktop backend — left on disk,
                       not part of the build or deploy path. See CHANGELOG.md.
docs/                 Full documentation (see below)
```

## Local development

Frontend:
```bash
cp .env.example .env   # set VITE_API_BASE_URL
npm install
npm run dev             # http://localhost:5173
npm run build            # zero-TypeScript-error production build -> dist/
```

Backend:
```bash
cd server
cp .env.example .env    # set DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY, R2_*, CORS_ORIGIN
npm install
npm run migrate          # apply schema.sql to your Postgres
npm start                # http://localhost:4000
npm run smoke-test       # pg-mem based checks, no real DB needed
```

## Deployment

See `docs/DEPLOYMENT.md` for the full Neon → Render → Vercel → R2 walkthrough,
and `docs/R2_SETUP.md` for the bucket/CORS/API-token specifics.

## Documentation

`docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/DEPLOYMENT.md`,
`docs/R2_SETUP.md`, `docs/VAULT_SECURITY.md`, `docs/ENVIRONMENT.md`,
`docs/TESTING.md`, `docs/CHANGELOG.md` (full project history, including the
discontinued desktop phase), plus the earlier `PROJECT_OVERVIEW.md`,
`FEATURES.md`, `INVOICE_GUIDE.md`, `EMAIL_SETUP.md`,
`API_KEYS_AND_SERVICES.md` carried over from before.

## Known gaps

- No real Neon/R2/Render/Vercel deployment has been exercised from the
  development environment that built this phase — only local builds and an
  in-memory (`pg-mem`) smoke test. See `docs/CHANGELOG.md` and
  `docs/DEPLOYMENT.md` for exactly what is and isn't verified.
- The old desktop app's encrypted backup/restore and "migrate local
  projects" vault features have no web equivalent yet (see
  `docs/VAULT_SECURITY.md`).
- `audit_logs` table exists in the schema but isn't yet written to by every
  route — a hook point for later.
