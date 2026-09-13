// Shared by both "reset workspace data" (server/src/routes/workspace.js)
// and "delete owner account" (server/src/routes/account.js) — deleting an
// account has to wipe the same workspace data, since nothing here has a
// user_id FK to cascade from (this is a single-owner app; business tables
// were never scoped per-user). Kept in one place so the two routes can't
// drift out of sync about what "all workspace data" means.
//
// IMPORTANT: this list is deliberately explicit, not "every table except
// users" — a table added later needs a conscious decision about whether
// resetting/deleting the account should clear it too.
export const WORKSPACE_TABLES_IN_DELETE_ORDER = [
  // Children first (also covered by ON DELETE CASCADE from their parents,
  // but listed explicitly so this works even if a table's FK is ever
  // loosened, and so global-scoped vault rows with a NULL project_id —
  // which CASCADE would never touch — are still cleared).
  'invoice_items',
  'payments',
  'project_links',
  'project_notes',
  'project_files',
  'project_images',
  'project_secrets',
  'project_passwords',
  'project_databases',
  'invoices',
  'projects',
  'clients',
  'business_settings',
  'audit_logs',
]

// Runs inside the caller's transaction (pass the checked-out `client`, not
// the pool) so this is atomic with whatever the caller does around it
// (e.g. also deleting the users row for account deletion).
export async function deleteAllWorkspaceData(client) {
  for (const table of WORKSPACE_TABLES_IN_DELETE_ORDER) {
    await client.query(`DELETE FROM ${table}`)
  }
}

// Collects storage keys for locally-stored files (project images, and any
// profile avatar saved via the same storage abstraction) BEFORE the DB rows
// are deleted, so the caller can best-effort delete the underlying files
// after the transaction commits. Actual file I/O is deliberately kept out
// of the DB transaction (per the task's own guidance) — if a delete fails
// here it's logged, not retried, and the DB-level reset is not rolled back
// for it; an orphaned file is a much smaller problem than a stuck reset.
//
// KNOWN LIMITATION: project_files (generic file attachments) live in
// Cloudflare R2 via a different client (server/src/lib/r2.js), not this
// storage abstraction — callers that also want those cleaned up must do it
// separately (see server/src/routes/workspace.js).
export async function collectLocalImageStorageKeys(client) {
  const { rows } = await client.query("SELECT storage_key FROM project_images WHERE storage_key IS NOT NULL AND storage_key <> ''")
  return rows.map((r) => r.storage_key)
}
