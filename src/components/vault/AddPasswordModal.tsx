import React, { useState } from 'react'
import { Modal } from '@/components/common/Modal'
import { Button } from '@/components/common/Button'
import { Input, Select, TextArea } from '@/components/common/Input'
import { vaultApi } from '@/vault/tauriClient'
import { useToast } from '@/hooks/useToast'
import { VAULT_ENVIRONMENTS, PasswordRecord } from '@/vault/types'
import { PasswordGeneratorPanel } from './PasswordGenerator'

interface Props {
  open: boolean
  onClose: () => void
  projectId: string | null
  onSaved: () => void
  editing?: PasswordRecord | null
}

export function AddPasswordModal({ open, onClose, projectId, onSaved, editing }: Props) {
  const { show } = useToast()
  const [title, setTitle] = useState(editing?.title ?? '')
  const [username, setUsername] = useState(editing?.username ?? '')
  const [websiteUrl, setWebsiteUrl] = useState(editing?.website_url ?? '')
  const [environment, setEnvironment] = useState(editing?.environment ?? 'Production')
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [password, setPassword] = useState('')
  const [replacing, setReplacing] = useState(!editing)
  const [showGenerator, setShowGenerator] = useState(false)
  const [busy, setBusy] = useState(false)

  React.useEffect(() => {
    if (open) {
      setTitle(editing?.title ?? '')
      setUsername(editing?.username ?? '')
      setWebsiteUrl(editing?.website_url ?? '')
      setEnvironment(editing?.environment ?? 'Production')
      setNotes(editing?.notes ?? '')
      setPassword('')
      setReplacing(!editing)
      setShowGenerator(false)
    }
  }, [open, editing])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setBusy(true)
    try {
      if (editing) {
        await vaultApi.passwordsUpdate({
          id: editing.id,
          title: title.trim(),
          username: username || null,
          website_url: websiteUrl || null,
          environment,
          notes: notes || null,
          new_password: replacing && password ? password : null,
        })
        show('Password updated')
      } else {
        if (!password) {
          show('Enter or generate a password', 'error')
          setBusy(false)
          return
        }
        await vaultApi.passwordsCreate({
          project_id: projectId,
          title: title.trim(),
          username: username || null,
          password,
          website_url: websiteUrl || null,
          environment,
          notes: notes || null,
        })
        show('Password added')
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
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Password' : 'Add Password'} size="md">
      <form onSubmit={submit} className="space-y-3">
        <Input label="Title / Service" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Firebase Console" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Username / Email" value={username} onChange={(e) => setUsername(e.target.value)} />
          <Select label="Environment" value={environment} onChange={(e) => setEnvironment(e.target.value)}>
            {VAULT_ENVIRONMENTS.map((env) => (
              <option key={env} value={env}>{env}</option>
            ))}
          </Select>
        </div>
        <Input label="Website URL" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://…" />

        {editing && !replacing ? (
          <div>
            <span className="block text-xs font-medium text-ink-400 mb-1">Password</span>
            <div className="flex items-center justify-between rounded-lg border border-surface-500 bg-surface-300 px-3 py-2">
              <span className="text-sm text-ink-500 tracking-widest">••••••••••••</span>
              <button type="button" onClick={() => setReplacing(true)} className="text-xs text-accent-400 hover:text-accent-300">
                Replace Value
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-ink-400">Password</span>
              <button type="button" onClick={() => setShowGenerator((s) => !s)} className="text-xs text-accent-400 hover:text-accent-300">
                {showGenerator ? 'Hide generator' : 'Generate Password'}
              </button>
            </div>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter or generate a password"
              className="w-full rounded-lg border border-surface-500 bg-surface-300 px-3 py-2 text-sm font-mono text-ink-100 placeholder:text-ink-500 outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/40"
            />
            {showGenerator && (
              <div className="mt-2.5">
                <PasswordGeneratorPanel onUse={(v) => { setPassword(v); setShowGenerator(false) }} />
              </div>
            )}
          </div>
        )}

        <TextArea label="Notes (optional)" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />

        <div className="flex items-center justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-lg border border-surface-500 bg-surface-300 px-3.5 py-2 text-sm text-ink-100 hover:bg-surface-400 transition-colors">
            Cancel
          </button>
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save Changes' : 'Add Password'}</Button>
        </div>
      </form>
    </Modal>
  )
}
