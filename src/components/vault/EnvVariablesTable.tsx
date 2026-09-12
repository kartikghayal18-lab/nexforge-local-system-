import React, { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { SecretRecord } from '@/vault/types'
import { vaultApi } from '@/vault/tauriClient'
import { RevealValue } from './RevealValue'
import { EnvironmentBadge, CategoryTag } from './EnvironmentBadge'
import { ConfirmDialog } from '@/components/common/Modal'
import { useToast } from '@/hooks/useToast'
import { formatRelativeTime } from '@/utils/format'

interface Props {
  secrets: SecretRecord[]
  onEdit: (s: SecretRecord) => void
  onChanged: () => void
  projectNameFor?: (projectId: string | null) => string
  onProjectClick?: (projectId: string) => void
}

export function EnvVariablesTable({ secrets, onEdit, onChanged, projectNameFor, onProjectClick }: Props) {
  const { show } = useToast()
  const [toDelete, setToDelete] = useState<SecretRecord | null>(null)

  async function remove() {
    if (!toDelete) return
    try {
      await vaultApi.secretsDelete(toDelete.id)
      show('Secret deleted')
      onChanged()
    } catch (e) {
      show(String(e), 'error')
    } finally {
      setToDelete(null)
    }
  }

  if (secrets.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-surface-500 bg-surface-200/50 px-6 py-10 text-center text-sm text-ink-500">
        No environment variables yet.
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-surface-400 bg-surface-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] font-medium text-ink-500 uppercase tracking-wide bg-surface-300 border-b border-surface-400">
              <th className="px-4 py-2.5">Key</th>
              {projectNameFor && <th className="px-4 py-2.5">Project</th>}
              <th className="px-4 py-2.5">Value</th>
              <th className="px-4 py-2.5">Environment</th>
              <th className="px-4 py-2.5">Type</th>
              <th className="px-4 py-2.5">Updated</th>
              <th className="px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-400">
            {secrets.map((s) => (
              <tr key={s.id} className="hover:bg-surface-300/50 transition-colors">
                <td className="px-4 py-3 font-mono text-xs font-medium text-ink-100">{s.name}</td>
                {projectNameFor && (
                  <td className="px-4 py-3">
                    <button
                      onClick={() => s.project_id && onProjectClick?.(s.project_id)}
                      className="text-ink-300 hover:text-accent-400 transition-colors text-left"
                    >
                      {projectNameFor(s.project_id)}
                    </button>
                  </td>
                )}
                <td className="px-4 py-3">
                  <RevealValue onReveal={() => vaultApi.secretsReveal(s.id)} />
                </td>
                <td className="px-4 py-3"><EnvironmentBadge environment={s.environment} /></td>
                <td className="px-4 py-3"><CategoryTag category={s.category} /></td>
                <td className="px-4 py-3 text-ink-500 text-xs">{formatRelativeTime(s.updated_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => onEdit(s)} title="Edit" className="grid place-items-center h-7 w-7 rounded-md text-ink-500 hover:text-ink-100 hover:bg-surface-400 transition-colors">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => setToDelete(s)} title="Delete" className="grid place-items-center h-7 w-7 rounded-md text-ink-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!toDelete}
        title={`Delete ${toDelete?.name}?`}
        message="This permanently removes this encrypted secret from the local vault."
        confirmLabel="Delete Secret"
        danger
        onConfirm={remove}
        onCancel={() => setToDelete(null)}
      />
    </div>
  )
}
