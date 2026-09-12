import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/common/Button'
import { Select } from '@/components/common/Input'
import { VaultGuard } from '@/components/vault/VaultGuard'
import { PasswordsTable } from '@/components/vault/PasswordsTable'
import { AddPasswordModal } from '@/components/vault/AddPasswordModal'
import { useVault } from '@/vault/VaultContext'
import { vaultApi } from '@/vault/tauriClient'
import { useProjects } from '@/hooks/useStore'
import { PasswordRecord, VAULT_ENVIRONMENTS } from '@/vault/types'

export default function Passwords() {
  const { desktop, unlocked } = useVault()
  const [showAdd, setShowAdd] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const canAct = desktop && unlocked

  return (
    <div>
      <PageHeader
        title="Passwords"
        subtitle="A real, encrypted password vault for every project login."
        actions={canAct ? <Button icon={<Plus size={15} />} onClick={() => setShowAdd(true)}>Add Password</Button> : undefined}
      />
      <VaultGuard>
        <PasswordsContent reloadKey={reloadKey} onReload={() => setReloadKey((k) => k + 1)} />
      </VaultGuard>
      <AddPasswordModal open={showAdd} onClose={() => setShowAdd(false)} projectId={null} onSaved={() => setReloadKey((k) => k + 1)} />
    </div>
  )
}

function PasswordsContent({ reloadKey, onReload }: { reloadKey: number; onReload: () => void }) {
  const [projects] = useProjects()
  const [passwords, setPasswords] = useState<PasswordRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [projectFilter, setProjectFilter] = useState('All')
  const [envFilter, setEnvFilter] = useState('All')
  const [editing, setEditing] = useState<PasswordRecord | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setPasswords(await vaultApi.passwordsList(null))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load, reloadKey])

  const projectNameFor = useCallback(
    (id: string | null) => (id ? projects.find((p) => p.id === id)?.name ?? 'Unassigned' : 'Unassigned'),
    [projects],
  )

  const filtered = useMemo(() => {
    return passwords.filter((p) => {
      if (projectFilter !== 'All' && (p.project_id ?? 'unassigned') !== projectFilter) return false
      if (envFilter !== 'All' && p.environment !== envFilter) return false
      const q = query.trim().toLowerCase()
      if (!q) return true
      return p.title.toLowerCase().includes(q) || (p.username ?? '').toLowerCase().includes(q)
    })
  }, [passwords, projectFilter, envFilter, query])

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 mb-5">
        <div className="relative w-full max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search passwords…"
            className="w-full rounded-lg border border-surface-500 bg-surface-300 pl-8 pr-3 py-2 text-sm text-ink-100 placeholder:text-ink-500 outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/40"
          />
        </div>
        <Select wrapperClassName="w-40" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
          <option value="All">All Projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </Select>
        <Select wrapperClassName="w-36" value={envFilter} onChange={(e) => setEnvFilter(e.target.value)}>
          <option value="All">All Environments</option>
          {VAULT_ENVIRONMENTS.map((env) => (
            <option key={env} value={env}>{env}</option>
          ))}
        </Select>
      </div>

      {loading ? (
        <p className="text-sm text-ink-500">Loading…</p>
      ) : (
        <PasswordsTable passwords={filtered} onEdit={(p) => setEditing(p)} onChanged={onReload} projectNameFor={projectNameFor} />
      )}

      <AddPasswordModal open={!!editing} onClose={() => setEditing(null)} projectId={editing?.project_id ?? null} onSaved={onReload} editing={editing} />
    </div>
  )
}
