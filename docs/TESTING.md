# Testing (Phase 4 — Web)

## What has actually been run

1. **Frontend build**: `npm run build` at the repo root — `tsc -b && vite
   build`. Result: zero TypeScript errors, Vite production build succeeds
   (`dist/` produced, ~102KB gzipped JS).
2. **Backend smoke test** (`server/scripts/smoke-test.js`, `npm run
   smoke-test` from `server/`): boots `server/db/schema.sql` against
   `pg-mem` (an in-memory, pure-JS Postgres emulator — no real Postgres
   needed) and exercises:
   register → login (bcrypt compare, including a wrong-password rejection)
   → create client → create project → create invoice with items (verifies
   the subtotal/tax/total math) → add a payment (verifies the invoice
   status auto-advances to "Paid") → vault encrypt/decrypt round-trip
   (verifies the stored value is ciphertext, not plaintext, and decrypts
   back to the original) → dashboard stats aggregation.
   **Last run: 11/11 checks passed.**
3. **Server graceful-failure check**: started `node server/src/server.js`
   with no `DATABASE_URL` set. It logs clear warnings and still starts;
   a request that hits the database (`POST /api/auth/login`) returns a
   clean `500 {"error":"Internal server error"}` via the centralized error
   handler, with the real `ECONNREFUSED` logged server-side — not a crash,
   not a hang.

## What this does NOT prove

`pg-mem` is a JS reimplementation of a subset of Postgres — it does not
implement every extension, function, or edge case identically to real
Postgres (see the workarounds in `smoke-test.js` for `pgcrypto` and a
volatile-default-in-a-loop quirk). Passing the smoke test means the SQL and
route logic aren't obviously broken; it does **not** mean the schema will
apply cleanly to Neon, that R2 presigned URLs work, that Render will start
the service correctly, or that Vercel will build/serve the frontend
correctly against a live API. None of those were reachable from the
environment this phase was built in — see `docs/DEPLOYMENT.md` for what the
owner needs to verify by hand after deploying.

## Manual test checklist (run this after a real deploy)

- [ ] Register the owner account once; confirm a second registration
      attempt returns 403.
- [ ] Log in, confirm the JWT persists across a page reload.
- [ ] Create a client, a project, an invoice with 2+ line items; confirm
      totals match manual calculation.
- [ ] Record a partial payment; confirm status becomes "Partially Paid";
      record the remainder; confirm it becomes "Paid".
- [ ] Download the invoice PDF; confirm it opens and shows correct data.
- [ ] Add a project secret; confirm the list shows a masked value; use
      "Reveal" and confirm the real value appears.
- [ ] Upload a project file; confirm it appears in the list and can be
      opened/downloaded; delete it and confirm it's gone from R2 too (not
      just the DB row).
- [ ] Log out (clear the token) and confirm every page redirects to
      `/login`.
