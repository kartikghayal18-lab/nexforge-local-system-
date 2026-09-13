# Database (Phase 4 — PostgreSQL on Neon)

Replaces the old local SQLite schema (`src-tauri/src/db.rs`, discontinued —
see `CHANGELOG.md`). Full DDL: `server/db/schema.sql`. Applied with
`node server/db/migrate.js` (reads `DATABASE_URL`).

## Tables

- **users** — single-owner auth + owner profile: `id`, `email` (unique), `password_hash` (bcrypt — a random unusable hash for OTP-only accounts), `created_at`, plus profile columns added in `db/migrations/003_owner_profile.sql` (`full_name`, `business_name`, `phone`, `avatar_url`, `address`, `website`, `gstin`, `currency`, `timezone`, `profile_completed_at`). Profile lives on this one row rather than a separate table since this is a single-owner app — there is never more than one profile to join against.
- **otp_codes** (added in `db/migrations/002_otp_codes.sql`) — email-OTP login: `email`, `code_hash` (bcrypt, never plaintext), `expires_at`, `consumed_at`, `attempt_count`, `created_at`. Also reused as the re-authentication step for account deletion (`DELETE /api/account`).
- **clients** — contact/billing info for studio clients.
- **projects** — linked to `clients` via `client_id` (`ON DELETE SET NULL`); also keeps a free-text `client` column for parity with the old schema's denormalized field.
- **project_links**, **project_notes** — `ON DELETE CASCADE` from `projects`.
- **project_files** — metadata only (`file_name`, `file_type`, `file_size`, `storage_key`, `url`). Bytes live in Cloudflare R2, addressed by `storage_key`.
- **project_images** (added in `db/migrations/001_project_images.sql`) — cover + gallery images per project: `project_id` (`ON DELETE CASCADE`), `url`, `storage_key` (needed to delete the underlying file), `is_cover boolean`, `file_name`, `file_size`, `mime_type`, `created_at`. Metadata only, same discipline as `project_files` — no binary/base64 in the row. Bytes currently live on the Express backend's local disk (`server/src/lib/storage/localDisk.js`), not R2 — see `docs/DEPLOYMENT.md` for why, and the caveat that comes with it. "At most one cover image per project" is enforced in application logic (`server/src/routes/projects.js`, inside a transaction that unsets the old cover before setting the new one), not a DB constraint — following this schema's existing precedent for invariants like this.
- **invoices**, **invoice_items**, **payments** — standard invoicing tables; `invoice_number` is unique and computed server-side (`PREFIX-YEAR-NNN`, see `server/src/lib/invoiceNumber.js`).
- **business_settings** — key/value store (business name, address, GSTIN, invoice prefix, R2 logo key, etc.) — replaces the old base64-logo-in-SQLite approach.
- **project_secrets**, **project_passwords**, **project_databases** — the vault. Sensitive fields (`encrypted_value`, `encrypted_password`, `encrypted_connection_string`) hold AES-256-GCM ciphertext only — see `docs/VAULT_SECURITY.md`.
- **audit_logs** — `user_id`, `action`, `entity_type`, `entity_id`, `detail jsonb`. Not yet wired into every route — a hook point for later, not fully utilized in this phase.

## Design notes vs. the old SQLite schema

- Real foreign keys with `ON DELETE CASCADE`/`SET NULL` everywhere, and an
  index on every FK column — the SQLite version avoided FKs entirely.
- UUIDs (`gen_random_uuid()`, via the `pgcrypto` extension) instead of
  app-generated string ids.
- `TIMESTAMPTZ DEFAULT now()` instead of ISO strings written by the app.

## Running migrations

```bash
cd server
cp .env.example .env   # fill in DATABASE_URL
npm install
npm run migrate
```

`db/migrate.js` applies `schema.sql` (idempotent — every statement is
`CREATE TABLE/INDEX IF NOT EXISTS`) then anything under `db/migrations/*.sql`
in alphabetical order, for future incremental changes.
