# Features

Status key: **Done (unverified at runtime)** = code is written, TypeScript
build passes, but nobody has yet run it inside an actual compiled Tauri app
(no Rust toolchain has been available in this development environment —
see docs/TESTING.md). **Done** = also manually confirmed in a running
desktop build. Update this file's checkmarks as you verify each item.

## Dashboard
- [x] (unverified) Stat cards (projects/clients/invoices/paid/pending/
      overdue/revenue/outstanding) from `dashboard_stats` Tauri command.
- [x] (unverified) Recent projects / recent invoices lists from real data.
- [x] Browser-mode fallback clearly banner-labeled "Demo data".

## Projects
- [x] (unverified) Create / edit / delete (SQLite via `projects_*`).
- [x] (unverified) Status, client link, tech stack, links, dates, budget,
      notes.
- [x] (unverified) Project Details workspace: Overview, Notes, Links,
      Files, Credentials (vault), Invoices list for that project.
- [ ] Kanban/board view — not implemented (list/grid only).

## Clients
- [x] (unverified) Create / edit / delete (SQLite via `clients_*`).
- [x] (unverified) Delete is blocked with a clear error if a client still
      has linked projects/invoices (referential-safety check in Rust).

## Invoices
- [x] (unverified) Create / edit / duplicate / delete (with confirmation).
- [x] (unverified) Sequential invoice numbers (`PREFIX-YEAR-NNN`).
- [x] (unverified) Line items, discount, tax rate, subtotal/total.
- [x] (unverified) Status (Draft/Sent/Paid/Partially Paid/Overdue/
      Cancelled), auto-advanced by recorded payments.
- [x] (unverified) Record payment, payment history, balance due.
- [x] (unverified) Real PDF export via Rust (`printpdf`) with a native
      save dialog — see docs/INVOICE_GUIDE.md. Browser-print is still
      available as a secondary "Print" button.

## Secure Vault
- [x] (unverified) Master password setup (Argon2id + random salt), never
      stored — only a salt + verifier ciphertext.
- [x] (unverified) AES-256-GCM per-field encryption for secrets,
      passwords, and database credentials.
- [x] (unverified) Lock / unlock / auto-lock (configurable minutes).
- [x] (unverified) Reveal with auto-hide, copy-to-clipboard with
      best-effort auto-clear.
- [x] (unverified) Global + per-project scoping.
- [ ] Multi-user / shared-vault support — intentionally out of scope
      (this is a single-user local vault).

## File Attachments
- [x] (unverified) Upload (50MB cap), list (name/type/size/date), open
      with OS default app, delete. Stored on disk under the app-data
      directory, organized as `files/project_<id>/<uuid>_<name>`.
- [x] (unverified) Path-traversal-safe filenames.

## Backup & Restore
- [x] (unverified) Encrypted `.nexforgevault` backup including clients,
      projects, project_notes, project_links, invoices, invoice_items,
      payments, secrets, passwords, databases, and now **file attachment
      bytes** (base64-embedded, restored back to disk).
- [x] (unverified) Restore requires the backup's original master password
      (by design — there is no password-reset/recovery path).
- [x] (unverified) Business `settings` table (company profile, incl.
      logo) is now included in the backup envelope.

## Settings
- [x] (unverified) Company profile (name, email, phone, address, website,
      GSTIN, invoice prefix, currency, default tax rate, payment terms,
      footer text) persisted via the `settings` SQLite table.
- [x] (unverified) Business logo upload (PNG/JPEG, ≤1MB, stored as base64
      in `settings`), shown in Settings and embedded in invoice PDFs.
- [ ] Payment/bank details tab is still `localStorage`-only (non-sensitive
      display text, not wired to SQLite yet).

## Global Search
- [x] (unverified) Searches projects, clients, invoices, project notes,
      and file names in desktop mode; navigates to the right page.

## Browser mode vs Desktop mode
Running `npm run dev` opens the app in a normal browser tab. Every
SQLite/vault/file/PDF feature requires the real Tauri backend, so browser
mode falls back to read-only seed/demo data with a visible banner. Browser
mode exists for fast UI iteration only — it is not the shipped product.
