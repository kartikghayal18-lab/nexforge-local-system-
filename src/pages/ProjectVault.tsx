import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Plus, FileDown, KeyRound, Lock, Database as DbIcon, Shield } from 'lucide-react'
import { Button } from '@/components/common/Button'
import { VaultGuard } from '@/components/vault/VaultGuard'
import { EnvVariablesTable } from '@/components/vault/EnvVariablesTable'
import { PasswordsTable } from '@/components/vault/PasswordsTable'
import { DatabasesTable } from '@/components/vault/DatabasesTable'
import { AddSecretModal } from '@/components/vault/AddSecretModal'
import { AddPasswordModal } from '@/components/vault/AddPasswordModal'
import { AddDatabaseModal } from '@/components/vault/AddDatabaseModal'
import { ImportEnvModal } from '@/components/vault/ImportEnvModal'
import { ExportEnvMenu } from '@/components/vault/ExportEnvMenu'
import { useVault } from '@/vault/VaultContext'
import { vaultApi } from '@/vault/tauriClient'
import { useProjects } from '@/hooks/useStore'
import { SecretRecord, PasswordRecord, DatabaseRecord } from '@/vault/types'

type Tab = 'env' | 'passwords' | 'databases' | 'other'

const tabs: { id: Tab; label: string; icon: any }[] = [
  { id: 'env', label: 'Environment Variables', icon: KeyRound },
  { id: 'passwords', label: 'Passwords', icon: Lock },
  { id: 'databases', label: 'Databases', icon: DbIcon },
  { id: 'other', label: 'Other Secrets', icon: Shield },
]

const ENV_LIKE_CATEGORIES = new Set(['API Key', 'API Secret', 'Firebase', 'Supabase', 'Neon', 'Payment Gateway', 'Hosting', 'GitHub', 'Vercel', 'Database URL', 'Database Password', 'Email'])

export default function ProjectVault() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [projects] = useProjects()
  const project = projects.find((p) => p.id === id)
  const [tab, setTab] = useState<Tab>((params.get('tab') as Tab) || 'env')

  const [secrets, setSecrets] = useState<SecretRecord[]>([])
  const [passwords, setPasswords] = useState<PasswordRecord[]>([])
  const [databases, setDatabases] = useState<DatabaseRecord[]>([])
  const [loading, setLoading] = useState(true)

  const [showAddSecret, setShowAddSecret] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showAddPassword, setShowAddPassword] = useState(false)
  const [showAddDatabase, setShowAddDatabase] = useState(false)
  const [editingSecret, setEditingSecret] = useState<SecretRecord | null>(null)
  const [editingPassword, setEditingPassword] = useState<PasswordRecord | null>(null)
  const [editingDatabase, setEditingDatabase] = useState<DatabaseRecord | null>(null)

  const { desktop, unlocked } = useVault()
  const canAct = desktop && unlocked

  const load = useCallback(async () => {
    if (!id || !canAct) { setLoading(false); return }
    setLoading(true)
    try {
      const [s, p, d] = await Promise.all([
        vaultApi.secretsList(id),
        vaultApi.passwordsList(id),
        vaultApi.databasesList(id),
      ])
      setSecrets(s)
      setPasswords(p)
      setDatabases(d)
    } finally {
      setLoading(false)
    }
  }, [id, canAct])

  useEffect(() => { load() }, [load])

  if (!project) {
    return (
      <div className="text-center py-20">
        <p className="text-sm text-ink-400">Project not found.</p>
        <button onClick={() => navigate('/projects')} className="mt-3 text-sm text-accent-400 hover:text-accent-300">Back to Projects</button>
      </div>
    )
  }

  const otherSecrets = secrets.filter((s) => !ENV_LIKE_CATEGORIES.has(s.category) && s.category !== 'Authentication')

  return (
    <div>
      <button onClick={() => navigate(`/projects/${id}`)} className="inline-flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-100 mb-4 transition-colors">
        <ArrowLeft size={14} /> Back to {project.name}
      </button>

      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-100">{project.name}</h1>
          <p className="text-sm text-ink-400 mt-0.5">Secure Vault</p>
        </div>
        <div className="flex items-center gap-2">
          {tab === 'env' && canAct && (
            <>
              <Button variant="secondary" size="sm" icon={<FileDown size={13} />} onClick={() => setShowImport(true)}>Import .env</Button>
              <ExportEnvMenu projectId={id ?? null} fileNameHint={project.name.toLowerCase().replace(/\s+/g, '-')} />
              <Button size="sm" icon={<Plus size={13} />} onClick={() => setShowAddSecret(true)}>Add Variable</Button>
            </>
          )}
          {tab === 'passwords' && canAct && (
            <Button size="sm" icon={<Plus size={13} />} onClick={() => setShowAddPassword(true)}>Add Password</Button>
          )}
          {tab === 'databases' && canAct && (
            <Button size="sm" icon={<Plus size={13} />} onClick={() => setShowAddDatabase(true)}>Add Database</Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 rounded-lg border border-surface-500 bg-surface-300 p-1 w-fit mb-5 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
              tab === t.id ? 'bg-accent-500 text-white' : 'text-ink-400 hover:text-ink-100'
            }`}
          >
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      <VaultGuard>
        {loading ? (
          <p className="text-sm text-ink-500">Loading…</p>
        ) : (
          <>
            {tab === 'env' && (
              <EnvVariablesTable secrets={secrets} onEdit={setEditingSecret} onChanged={load} />
            )}
            {tab === 'passwords' && (
              <PasswordsTable passwords={passwords} onEdit={setEditingPassword} onChanged={load} />
            )}
            {tab === 'databases' && (
              <DatabasesTable databases={databases} onEdit={setEditingDatabase} onChanged={load} />
            )}
            {tab === 'other' && (
              <EnvVariablesTable secrets={otherSecrets} onEdit={setEditingSecret} onChanged={load} />
            )}
          </>
        )}
      </VaultGuard>

      <AddSecretModal open={showAddSecret} onClose={() => setShowAddSecret(false)} projectId={id ?? null} onSaved={load} />
      <AddSecretModal open={!!editingSecret} onClose={() => setEditingSecret(null)} projectId={id ?? null} onSaved={load} editing={editingSecret} />
      <ImportEnvModal open={showImport} onClose={() => setShowImport(false)} projectId={id ?? null} onImported={load} />
      <AddPasswordModal open={showAddPassword} onClose={() => setShowAddPassword(false)} projectId={id ?? null} onSaved={load} />
      <AddPasswordModal open={!!editingPassword} onClose={() => setEditingPassword(null)} projectId={id ?? null} onSaved={load} editing={editingPassword} />
      <AddDatabaseModal open={showAddDatabase} onClose={() => setShowAddDatabase(false)} projectId={id ?? null} onSaved={load} />
      <AddDatabaseModal open={!!editingDatabase} onClose={() => setEditingDatabase(null)} projectId={id ?? null} onSaved={load} editing={editingDatabase} />
    </div>
  )
}
