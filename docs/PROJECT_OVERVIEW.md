# Project Overview

## What it is
Nexforge Studio Manager is a private, local-first desktop application for a
single freelancer/agency to manage their own business: projects, clients,
invoices, payments, project files, and sensitive credentials (API keys,
passwords, database connection strings) in one place, without depending on
any cloud service.

## Purpose
Replace a scattered mix of spreadsheets, sticky notes, and a browser
password manager with one tool that lives entirely on the user's machine.

## Target users
A solo developer or small studio (the app ships with "Nexforge Studios" /
"Prathamesh" branding as the default profile, but Settings > Company
Profile lets any user rebrand it to their own business).

## Core workflows
- Track projects (status, tech stack, links, budget, deadline) per client.
- Manage clients and see which projects belong to them.
- Build invoices against a project/client, itemized with tax and discount,
  track payments against them, and export a PDF.
- Store project-specific files (contracts, assets, exports) on disk,
  organized by project.
- Store sensitive secrets (API keys, passwords, DB credentials) in an
  encrypted local vault, scoped globally or per-project.
- Back up and restore the entire local database (and file attachments) to
  a single encrypted file.

## Architecture (see docs/ARCHITECTURE.md for detail)
- **Frontend:** React + TypeScript + Vite + Tailwind CSS, running either in
  a normal browser (`npm run dev`, for UI iteration) or inside a Tauri
  desktop window (`npm run tauri:dev`).
- **Backend:** Rust, via Tauri 2 commands — the only way the frontend
  touches the filesystem, the database, or cryptography.
- **Database:** SQLite, a single file in the OS application-data
  directory (never inside the source folder, never in the browser).
- **Vault:** a Rust-side encrypted store (Argon2id + AES-256-GCM) for
  secrets/passwords/database credentials, gated behind a master password
  that is never stored.

## Data flow
UI action → `coreApi`/`vaultApi` (`src/data`, `src/vault`) → `invoke()` a
named Tauri command → Rust handler in `src-tauri/src/{core,commands,pdf,
backup}.rs` → SQLite (`src-tauri/src/db.rs`) and/or the local filesystem →
typed JSON result back to the UI. There is no server, no network call, and
no ORM in this path.

## Desktop security model
- All privileged operations (DB reads/writes, file I/O, encryption) happen
  in Rust; the frontend never talks to SQLite or the filesystem directly.
- Vault plaintext only ever exists in Rust memory while the vault is
  unlocked, and only for the duration of a `reveal`/`export` call.
- The frontend never uses `localStorage` for anything sensitive. It's only
  used for a couple of non-sensitive UI conveniences in **browser preview
  mode** (see docs/FEATURES.md — browser mode is a fallback, not the
  product).
