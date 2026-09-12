// REST client for the vault (secrets/passwords/database credentials).
// Replaces the old Tauri `invoke()` wrapper around the Rust-encrypted
// SQLite vault. There is no more per-request "master password unlock" —
// encryption now happens server-side (AES-256-GCM, keyed by
// process.env.ENCRYPTION_KEY) and access control is the JWT itself. See
// docs/VAULT_SECURITY.md for the reasoning.
//
// Kept as `tauriClient.ts` (rather than renamed) so existing imports across
// the vault UI (`VaultContext.tsx`, pages, components) don't all need
// touching — only the internals changed.
import { getToken, API_BASE_URL } from '../auth/AuthContext'
import type {
  VaultStatus,
  SecretRecord,
  NewSecretInput,
  UpdateSecretInput,
  PasswordRecord,
  NewPasswordInput,
  UpdatePasswordInput,
  DatabaseRecord,
  NewDatabaseInput,
  UpdateDatabaseInput,
  DatabaseSecrets,
} from './types'

// No more desktop/browser distinction — the whole app requires sign-in.
export function isDesktop(): boolean {
  return !!getToken()
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Request failed: ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

const get = <T>(path: string) => request<T>(path)
const post = <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined })
const put = <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body: body !== undefined ? JSON.stringify(body) : undefined })
const del = <T>(path: string) => request<T>(path, { method: 'DELETE' })
const qs = (projectId?: string | null) => (projectId ? `?project_id=${encodeURIComponent(projectId)}` : '')

export const vaultApi = {
  // There's no lock/unlock concept anymore — JWT auth IS the gate. These are
  // kept as no-ops so existing UI (auto-lock timers, lock button) doesn't
  // crash; they report "always unlocked while signed in".
  status: async (): Promise<VaultStatus> => ({ initialized: true, unlocked: isDesktop(), auto_lock_minutes: 0 }),
  create: async (_masterPassword: string) => {},
  unlock: async (_masterPassword: string) => {},
  lock: async () => {},
  touchActivity: async () => {},
  setAutoLock: async (_minutes: number) => {},
  changeMasterPassword: async (_currentPassword: string, _newPassword: string) => {
    throw new Error('Master password vault unlock no longer applies — this app is now protected by your account login.')
  },

  secretsList: (projectId?: string | null) => get<SecretRecord[]>(`/api/vault/secrets${qs(projectId)}`),
  secretsCreate: (input: NewSecretInput) => post<{ id: string }>('/api/vault/secrets', input).then((r) => r.id),
  secretsBulkCreate: async (items: NewSecretInput[]) => {
    let count = 0
    for (const item of items) {
      await post<{ id: string }>('/api/vault/secrets', item)
      count++
    }
    return count
  },
  secretsUpdate: (input: UpdateSecretInput) => put<void>(`/api/vault/secrets/${input.id}`, input),
  secretsDelete: (id: string) => del<void>(`/api/vault/secrets/${id}`),
  secretsReveal: (id: string) => get<{ value: string }>(`/api/vault/secrets/${id}/reveal`).then((r) => r.value),
  secretsExport: async (projectId?: string | null): Promise<[string, string][]> => {
    const list = await get<SecretRecord[]>(`/api/vault/secrets${qs(projectId)}`)
    const out: [string, string][] = []
    for (const s of list) {
      const value = await get<{ value: string }>(`/api/vault/secrets/${s.id}/reveal`).then((r) => r.value)
      out.push([s.name, value])
    }
    return out
  },

  passwordsList: (projectId?: string | null) => get<PasswordRecord[]>(`/api/vault/passwords${qs(projectId)}`),
  passwordsCreate: (input: NewPasswordInput) => post<{ id: string }>('/api/vault/passwords', input).then((r) => r.id),
  passwordsUpdate: (input: UpdatePasswordInput) => put<void>(`/api/vault/passwords/${input.id}`, input),
  passwordsDelete: (id: string) => del<void>(`/api/vault/passwords/${id}`),
  passwordsReveal: (id: string) => get<{ value: string }>(`/api/vault/passwords/${id}/reveal`).then((r) => r.value),

  databasesList: (projectId?: string | null) => get<DatabaseRecord[]>(`/api/vault/databases${qs(projectId)}`),
  databasesCreate: (input: NewDatabaseInput) => post<{ id: string }>('/api/vault/databases', input).then((r) => r.id),
  databasesUpdate: (input: UpdateDatabaseInput) => put<void>(`/api/vault/databases/${input.id}`, input),
  databasesDelete: (id: string) => del<void>(`/api/vault/databases/${id}`),
  databasesReveal: (id: string) => get<DatabaseSecrets>(`/api/vault/databases/${id}/reveal`),

  // Desktop-only migration/backup features have no web equivalent yet.
  projectsMigrate: async (_projects: unknown[]) => 0,
  appDataDir: async () => '',
  backupExport: async (_filePath: string) => {
    throw new Error('Backup export is not available in the web version yet.')
  },
  backupPreview: async (
    _filePath: string,
  ): Promise<{ format: string; created_at: string; projects: number; secrets: number; passwords: number; databases: number }> => {
    throw new Error('Backup restore is not available in the web version yet.')
  },
  backupRestore: async (_filePath: string, _masterPassword: string) => {
    throw new Error('Backup restore is not available in the web version yet.')
  },
}
