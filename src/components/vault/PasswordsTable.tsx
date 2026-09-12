import React, { useState } from 'react'
import { Pencil, Trash2, Copy, Eye, EyeOff, ExternalLink } from 'lucide-react'
import { PasswordRecord } from '@/vault/types'
import { vaultApi } from '@/vault/tauriClient'
import { EnvironmentBadge } from './EnvironmentBadge'
import { ConfirmDialog } from '@/components/common/Modal'
import { useToast } from '@/hooks/useToast'
import { copySecurely } from '@/vault/VaultContext'
import { formatRelativeTime } from '@/utils/format'

interface Props {
  passwords: PasswordRecord[]
  onEdit: (p: PasswordRecord) => void
  onChanged: () => void
  projectNameFor?: (projectId: string | null) => string
}

export function PasswordsTable({ passwords, onEdit, onChanged, projectNameFor }: Props) {
  const { show } = useToast()
  const [toDelete, setToDelete] = useState<PasswordRecord | null>(null)
  const [revealed, setRevealed] = useState<Record<string, string>>({})

  async function toggleReveal(p: PasswordRecord) {
    if (revealed[p.id]) {
      setRevealed((r) => { const n = { ...r }; delete n[p.id]; return n })
      return
    }
    try {
      const value = await vaultApi.passwordsReveal(p.id)
      setRevealed((r) => ({ ...r, [p.id]: value }))
      window.setTimeout(() => setRevealed((r) => { const n = { ...r }; delete n[p.id]; return n }), 30_000)
    } catch (e) {
      show(String(e), 'error')
    }
  }

  async function copyUsername(p: PasswordRecord) {
    if (!p.username) return
    await navigator.clipboard.writeText(p.username)
    show('Username copied')
  }

  async function copyPassword(p: PasswordRecord) {
    try {
      const value = revealed[p.id] ?? (await vaultApi.passwordsReveal(p.id))
      await copySecurely(value)
      show('Copied securely')
    } catch (e) {
      show(String(e), 'error')
    }
  }

  async function remove() {
    if (!toDelete) return
    try {
      await vaultApi.passwordsDelete(toDelete.id)
      show('Password deleted')
      onChanged()
    } catch (e) {
      show(String(e), 'error')
    } finally {
      setToDelete(null)
    }
  }

  if (passwords.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-surface-500 bg-surface-200/50 px-6 py-10 text-center text-sm text-ink-500">
        No passwords saved yet.
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-surface-400 bg-surface-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] font-medium text-ink-500 uppercase tracking-wide bg-surface-300 border-b border-surface-400">
              <th className="px-4 py-2.5">Service</th>
              {projectNameFor && <th className="px-4 py-2.5">Project</th>}
              <th className="px-4 py-2.5">Username</th>
              <th className="px-4 py-2.5">Password</th>
              <th className="px-4 py-2.5">Environment</th>
              <th className="px-4 py-2.5">Updated</th>
              <th className="px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-400">
            {passwords.map((p) => (
              <tr key={p.id} className="hover:bg-surface-300/50 transition-colors">
                <td className="px-4 py-3 font-medium text-ink-100">{p.title}</td>
                {projectNameFor && <td className="px-4 py-3 text-ink-300">{projectNameFor(p.project_id)}</td>}
                <td className="px-4 py-3 text-ink-300">{p.username || '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-ink-300 tracking-widest select-none">
                      {revealed[p.id] ?? '••••••••••••'}
                    </span>
                    <button onClick={() => toggleReveal(p)} className="text-ink-500 hover:text-ink-100 transition-colors">
                      {revealed[p.id] ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                    <button onClick={() => copyPassword(p)} title="Copy password" className="text-ink-500 hover:text-ink-100 transition-colors">
                      <Copy size={13} />
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3"><EnvironmentBadge environment={p.environment} /></td>
                <td className="px-4 py-3 text-ink-500 text-xs">{formatRelativeTime(p.updated_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {p.username && (
                      <IconBtn title="Copy username" onClick={() => copyUsername(p)}><Copy size={13} /></IconBtn>
                    )}
                    {p.website_url && (
                      <IconBtn title="Open website" onClick={() => window.open(p.website_url!, '_blank')}><ExternalLink size={13} /></IconBtn>
                    )}
                    <IconBtn title="Edit" onClick={() => onEdit(p)}><Pencil size={13} /></IconBtn>
                    <IconBtn title="Delete" danger onClick={() => setToDelete(p)}><Trash2 size={13} /></IconBtn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!toDelete}
        title="Delete Password?"
        message={`This permanently removes "${toDelete?.title}" from the local vault.`}
        confirmLabel="Delete Password"
        danger
        onConfirm={remove}
        onCancel={() => setToDelete(null)}
      />
    </div>
  )
}

function IconBtn({ children, onClick, title, danger }: { children: React.ReactNode; onClick: () => void; title: string; danger?: boolean }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`grid place-items-center h-7 w-7 rounded-md transition-colors ${
        danger ? 'text-ink-500 hover:text-rose-400 hover:bg-rose-500/10' : 'text-ink-500 hover:text-ink-100 hover:bg-surface-400'
      }`}
    >
      {children}
    </button>
  )
}
