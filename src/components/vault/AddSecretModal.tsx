import React, { useState } from 'react'
import { Modal } from '@/components/common/Modal'
import { Button } from '@/components/common/Button'
import { Input, Select, TextArea } from '@/components/common/Input'
import { vaultApi } from '@/vault/tauriClient'
import { useToast } from '@/hooks/useToast'
import { SECRET_CATEGORIES, VAULT_ENVIRONMENTS, SecretRecord } from '@/vault/types'
import { ENV_PRESETS, guessCategoryForKey } from '@/vault/envPresets'
import { useProjectPicker } from './useProjectPicker'
import { useNavigate } from 'react-router-dom'

interface Props {
  open: boolean
  onClose: () => void
  projectId: string | null
  onSaved: () => void
  editing?: SecretRecord | null
}

export function AddSecretModal({ open, onClose, projectId, onSaved, editing }: Props) {
  const { show } = useToast()
  const navigate = useNavigate()
  const picker = useProjectPicker(projectId)
  const [name, setName] = useState(editing?.name ?? '')
  const [category, setCategory] = useState(editing?.category ?? 'API Key')
  const [environment, setEnvironment] = useState(editing?.environment ?? 'Production')
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [value, setValue] = useState('')
  const [replacing, setReplacing] = useState(!editing)
  const [busy, setBusy] = useState(false)

  React.useEffect(() => {
    if (open) {
      setName(editing?.name ?? '')
      setCategory(editing?.category ?? 'API Key')
      setEnvironment(editing?.environment ?? 'Production')
      setNotes(editing?.notes ?? '')
      setValue('')
      setReplacing(!editing)
    }
  }, [open, editing])

  function applyPresetKey(key: string) {
    setName(key)
    setCategory(guessCategoryForKey(key))
  }

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
        await vaultApi.secretsUpdate({
          id: editing.id,
          name: name.trim(),
          category,
          environment,
          notes: notes || null,
          new_value: replacing && value ? value : null,
        })
        show('Secret updated')
      } else {
        if (!value) {
          show('Enter a value for this variable', 'error')
          setBusy(false)
          return
        }
        await vaultApi.secretsCreate({
          project_id: picker.resolvedProjectId,
          name: name.trim().toUpperCase().replace(/\s+/g, '_'),
          category,
          environment,
          value,
          notes: notes || null,
        })
        show('Secret added')
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
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Variable' : 'Add Variable'} size="md">
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
        {!editing && (
          <div>
            <span className="block text-xs font-medium text-ink-400 mb-1.5">Quick presets</span>
            <div className="flex flex-wrap gap-1.5">
              {ENV_PRESETS.flatMap((p) => p.vars).map((v) => (
                <button
                  type="button"
                  key={v.key}
                  onClick={() => applyPresetKey(v.key)}
                  className="text-[11px] font-mono rounded-md border border-surface-500 bg-surface-300 px-2 py-1 text-ink-300 hover:border-accent-500/50 hover:text-ink-100 transition-colors"
                >
                  {v.key}
                </button>
              ))}
            </div>
          </div>
        )}

        <Input label="Variable Name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="DATABASE_URL" className="font-mono" />

        {editing && !replacing ? (
          <div>
            <span className="block text-xs font-medium text-ink-400 mb-1">Variable Value</span>
            <div className="flex items-center justify-between rounded-lg border border-surface-500 bg-surface-300 px-3 py-2">
              <span className="text-sm text-ink-500 tracking-widest">••••••••••••••••</span>
              <button type="button" onClick={() => setReplacing(true)} className="text-xs text-accent-400 hover:text-accent-300">
                Replace Value
              </button>
            </div>
          </div>
        ) : (
          <TextArea
            label="Variable Value"
            required={!editing}
            rows={3}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Paste the secret value here"
            className="font-mono text-xs"
          />
        )}

        <div className="grid grid-cols-2 gap-3">
          <Select label="Environment" value={environment} onChange={(e) => setEnvironment(e.target.value)}>
            {VAULT_ENVIRONMENTS.map((env) => (
              <option key={env} value={env}>{env}</option>
            ))}
          </Select>
          <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
            {SECRET_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </div>

        <Input label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Where this came from, rotation reminders, etc." />

        <div className="flex items-center justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-lg border border-surface-500 bg-surface-300 px-3.5 py-2 text-sm text-ink-100 hover:bg-surface-400 transition-colors">
            Cancel
          </button>
          <Button type="submit" disabled={busy || (!editing && !picker.canSubmit)}>{busy ? 'Saving…' : editing ? 'Save Changes' : 'Add Variable'}</Button>
        </div>
      </form>
    </Modal>
  )
}
