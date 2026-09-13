# Vault Security (Phase 4 — web)

## What changed from the desktop app

The old Tauri app used a **master-password-gated, per-request-unlocked**
vault: a local SQLite database held ciphertext, and the Rust backend derived
a decryption key from a master password the user entered to "unlock" the
vault for a session, auto-locking after inactivity.

That model doesn't map to a web app with no persistent local process to hold
an unlocked key in memory. The new design:

- **Encryption**: AES-256-GCM, applied per-field, in `server/src/lib/crypto.js`.
  The key is a single server-side secret, `ENCRYPTION_KEY` (32 random bytes,
  base64), set once as a Render environment variable. It never touches the
  frontend.
- **Access control is the JWT**, not a second "unlock" step. If you're
  signed in, you can read the vault — the same as every other resource in
  this single-owner app. There is no separate master password anymore.
- **List endpoints never return plaintext.** `GET /api/vault/secrets`,
  `/passwords`, `/databases` return masked values (`"••••••••"`) or omit the
  sensitive field entirely. Plaintext is decrypted only inside a dedicated
  `GET /:id/reveal` route, called explicitly by the "Reveal" UI action.
- **Plaintext is never logged**, and no route other than `/reveal` ever puts
  a decrypted value in a response body.

## Why this is a deliberate simplification, not an oversight

The desktop master password protected against someone with **filesystem
access to the laptop** reading the SQLite file. In the web architecture,
`ENCRYPTION_KEY` protects against someone with **database access but not the
API server's environment** reading raw Postgres rows (a Neon dashboard leak,
a DB backup that ends up somewhere else, an admin panel bug). The JWT
protects against everyone else. Combining "prove you're the owner" (JWT) and
"the DB alone isn't enough" (AES-256-GCM) covers the realistic threat model
for a personal, single-owner tool — without a client-side unlock ritual that
has no clean equivalent once there's no long-lived desktop process to hold
the key in memory.

## What this does NOT protect against

- A leaked `JWT_SECRET` or a stolen valid JWT gives full API access,
  including reveal endpoints, until the token expires (7 days) — there is no
  separate "vault lock" that would still block it. Rotate `JWT_SECRET` to
  invalidate all outstanding tokens if this happens.
- A leaked `ENCRYPTION_KEY` lets anyone with a DB dump decrypt every vault
  row. Store it only in Render's environment variable settings, never in
  git, and rotate it (re-encrypting existing rows) if it's ever exposed.
- This is a **single-owner** app. There is no per-user vault partitioning —
  registration is deliberately locked to one account (see `POST
  /api/auth/register`, and identically enforced for the newer `POST
  /api/auth/verify-otp` flow — see `docs/ARCHITECTURE.md`'s Auth section).
  Signing in via email OTP still issues the exact same JWT as password
  login, so everything above about JWT scope and expiry applies unchanged
  regardless of which login method was used.

## Backup/restore and cross-device migration

The desktop app's encrypted `.nexforgevault` backup/restore and "migrate
local projects" features have no web equivalent yet — Postgres itself is now
the durable store (back it up via Neon's own backup/branching features), and
there's nothing local left to migrate from once the switch is made. The
vault UI still shows those buttons; they now surface a clear "not available
in the web version yet" error instead of silently failing.
