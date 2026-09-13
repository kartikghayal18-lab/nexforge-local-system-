import React, { useState } from 'react'
import { Modal } from '@/components/common/Modal'
import { Button } from '@/components/common/Button'
import { Input, Select, TextArea } from '@/components/common/Input'
import { vaultApi } from '@/vault/tauriClient'
import { useToast } from '@/hooks/useToast'
import { VAULT_ENVIRONMENTS, DATABASE_PROVIDERS, DatabaseRecord } from '@/vault/types'
import { useProjectPicker } from './useProjectPicker'
import { useNavigate } from 'react-router-dom'

interface Props {
  open: boolean
  onClose: () => void
  projectId: string | null
  onSaved: () => void
  editing?: DatabaseRecord | null
}

export function AddDatabaseModal({ open, onClose, projectId, onSaved, editing }: Props) {
  const { show } = useToast()
  const navigate = useNavigate()
  const picker = useProjectPicker(projectId)
  const [name, setName] = useState(editing?.name ?? '')
  const [provider, setProvider] = useState(editing?.provider ?? 'PostgreSQL')
  const [host, setHost] = useState(editing?.host ?? '')
  const [port, setPort] = useState(editing?.port ?? '')
  const [databaseName, setDatabaseName] = useState(editing?.database_name ?? '')
  const [username, setUsername] = useState(editing?.username ?? '')
  const [environment, setEnvironment] = useState(editing?.environment ?? 'Production')
  const [connectionString, setConnectionString] = useState('')
  const [password, setPassword] = useState('')
  const [replaceCs, setReplaceCs] = useState(!editing)
  const [replacePw, setReplacePw] = useState(!editing)
  const [busy, setBusy] = useState(false)

  React.useEffect(() => {
    if (open) {
      setName(editing?.name ?? '')
      setProvider(editing?.provider ?? 'PostgreSQL')
      setHost(editing?.host ?? '')
      setPort(editing?.port ?? '')
      setDatabaseName(editing?.database_name ?? '')
      setUsername(editing?.username ?? '')
      setEnvironment(editing?.environment ?? 'Production')
      setConnectionString('')
      setPassword('')
      setReplaceCs(!editing)
      setReplacePw(!editing)
    }
  }, [open, editing])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    if (!editing && !picker.canSubmit) {
      show('Choose a project first', 'error')
      return
    }
    setBusy(true)
    try {
      if (editing) {
        await vaultApi.databasesUpdate({
          id: editing.id,
          name: name.trim(),
          provider,
          host: host || null,
          port: port || null,
          database_name: databaseName || null,
          username: username || null,
          environment,
          new_connection_string: replaceCs && connectionString ? connectionString : null,
          new_password: replacePw && password ? password : null,
        })
        show('Database credential updated')
      } else {
        await vaultApi.databasesCreate({
          project_id: picker.resolvedProjectId,
          name: name.trim(),
          provider,
          host: host || null,
          port: port || null,
          database_name: databaseName || null,
          username: username || null,
          connection_string: connectionString || null,
          password: password || null,
          environment,
        })
        show('Database credential added')
      }
      onSaved()
      onClose()
    } catch (err) {
      show(String(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Database' : 'Add Database'} size="lg">
      <form onSubmit={submit} className="space-y-3">
        {!editing && picker.needsPicker && (
          picker.noProjects ? (
            <p className="text-xs text-amber-400">
              You need a project first. <button type="button" onClick={() => navigate('/projects?new=1')} className="underline hover:text-amber-300">Create a project</button>
            </p>
          ) : (
            <Select label="Project" required value={picker.selected} onChange={(e) => picker.setSelected(e.target.value)}>
              <option value="">Select a project…</option>
              {picker.projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          )
        )}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Production PostgreSQL" />
          <Select label="Provider" value={provider} onChange={(e) => setProvider(e.target.value)}>
            {DATABASE_PROVIDERS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </Select>
        </div>

        {editing && !replaceCs ? (
          <MaskedField label="Connection String / URL" onReplace={() => setReplaceCs(true)} />
        ) : (
          <TextArea label="Connection String / URL" rows={2} value={connectionString} onChange={(e) => setConnectionString(e.target.value)} placeholder="postgresql://user:pass@host:5432/dbname" className="font-mono text-xs" />
        )}

        <div className="grid grid-cols-2 gap-3">
          <Input label="Host" value={host} onChange={(e) => setHost(e.target.value)} placeholder="ep-example.neon.tech" />
          <Input label="Port" value={port} onChange={(e) => setPort(e.target.value)} placeholder="5432" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Database Name" value={databaseName} onChange={(e) => setDatabaseName(e.target.value)} placeholder="nexforge" />
          <Input label="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>

        {editing && !replacePw ? (
          <MaskedField label="Password" onReplace={() => setReplacePw(true)} />
        ) : (
          <Input label="Password" type="text" value={password} onChange={(e) => setPassword(e.target.value)} className="font-mono" />
        )}

        <Select label="Environment" value={environment} onChange={(e) => setEnvironment(e.target.value)}>
          {VAULT_ENVIRONMENTS.map((env) => (
            <option key={env} value={env}>{env}</option>
          ))}
        </Select>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-lg border border-surface-500 bg-surface-300 px-3.5 py-2 text-sm text-ink-100 hover:bg-surface-400 transition-colors">
            Cancel
          </button>
          <Button type="submit" disabled={busy || (!editing && !picker.canSubmit)}>{busy ? 'Saving…' : editing ? 'Save Changes' : 'Add Database'}</Button>
        </div>
      </form>
    </Modal>
  )
}

function MaskedField({ label, onReplace }: { label: string; onReplace: () => void }) {
  return (
    <div>
      <span className="block text-xs font-medium text-ink-400 mb-1">{label}</span>
      <div className="flex items-center justify-between rounded-lg border border-surface-500 bg-surface-300 px-3 py-2">
        <span className="text-sm text-ink-500 tracking-widest">••••••••••••••••</span>
        <button type="button" onClick={onReplace} className="text-xs text-accent-400 hover:text-accent-300">
          Replace Value
        </button>
      </div>
    </div>
  )
}
