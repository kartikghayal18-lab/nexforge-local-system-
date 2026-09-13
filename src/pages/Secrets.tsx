import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, FileDown, Search } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/common/Button'
import { Select } from '@/components/common/Input'
import { VaultGuard } from '@/components/vault/VaultGuard'
import { EnvVariablesTable } from '@/components/vault/EnvVariablesTable'
import { AddSecretModal } from '@/components/vault/AddSecretModal'
import { ImportEnvModal } from '@/components/vault/ImportEnvModal'
import { ExportEnvMenu } from '@/components/vault/ExportEnvMenu'
import { useVault } from '@/vault/VaultContext'
import { vaultApi } from '@/vault/tauriClient'
import { coreApi } from '@/data/coreClient'
import type { ProjectFull } from '@/data/coreTypes'
import { SecretRecord, VAULT_ENVIRONMENTS, SECRET_CATEGORIES } from '@/vault/types'

export default function Secrets() {
  const { desktop, unlocked } = useVault()
  const [showAdd, setShowAdd] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const canAct = desktop && unlocked

  return (
    <div>
      <PageHeader
        title="Secrets & Keys"
        subtitle="Manage project credentials, API keys and environment variables securely."
        actions={
          canAct ? (
            <>
              <Button variant="secondary" icon={<FileDown size={15} />} onClick={() => setShowImport(true)}>Import .env</Button>
              <Button icon={<Plus size={15} />} onClick={() => setShowAdd(true)}>Add Secret</Button>
            </>
          ) : undefined
        }
      />
      <VaultGuard>
        <SecretsContent reloadKey={reloadKey} onReload={() => setReloadKey((k) => k + 1)} />
      </VaultGuard>

      <AddSecretModal open={showAdd} onClose={() => setShowAdd(false)} projectId={null} onSaved={() => setReloadKey((k) => k + 1)} />
      <ImportEnvModal open={showImport} onClose={() => setShowImport(false)} projectId={null} onImported={() => setReloadKey((k) => k + 1)} />
    </div>
  )
}

function SecretsContent({ reloadKey, onReload }: { reloadKey: number; onReload: () => void }) {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<ProjectFull[]>([])
  useEffect(() => { coreApi.projectsList().then(setProjects).catch(() => setProjects([])) }, [])
  const [secrets, setSecrets] = useState<SecretRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [projectFilter, setProjectFilter] = useState('All')
  const [envFilter, setEnvFilter] = useState('All')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [editing, setEditing] = useState<SecretRecord | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setSecrets(await vaultApi.secretsList(null))
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
    return secrets.filter((s) => {
      if (projectFilter !== 'All' && (s.project_id ?? 'unassigned') !== projectFilter) return false
      if (envFilter !== 'All' && s.environment !== envFilter) return false
      if (categoryFilter !== 'All' && s.category !== categoryFilter) return false
      const q = query.trim().toLowerCase()
      if (!q) return true
      // Search only metadata — key name, project, category — never the encrypted value.
      return (
        s.name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        projectNameFor(s.project_id).toLowerCase().includes(q)
      )
    })
  }, [secrets, projectFilter, envFilter, categoryFilter, query, projectNameFor])

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 mb-5">
        <div className="relative w-full max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search secrets…"
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
        <Select wrapperClassName="w-40" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="All">All Categories</option>
          {SECRET_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>
        <div className="flex-1" />
        <ExportEnvMenu projectId={null} fileNameHint="nexforge-secrets" />
      </div>

      {loading ? (
        <p className="text-sm text-ink-500">Loading…</p>
      ) : (
        <EnvVariablesTable
          secrets={filtered}
          onEdit={(s) => setEditing(s)}
          onChanged={onReload}
          projectNameFor={projectNameFor}
          onProjectClick={(id) => navigate(`/projects/${id}`)}
        />
      )}

      <AddSecretModal open={!!editing} onClose={() => setEditing(null)} projectId={editing?.project_id ?? null} onSaved={onReload} editing={editing} />
    </div>
  )
}
