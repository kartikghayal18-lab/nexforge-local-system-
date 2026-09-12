import React, { useState } from 'react'
import { Pencil, Trash2, Copy, Database as DbIcon } from 'lucide-react'
import { DatabaseRecord } from '@/vault/types'
import { vaultApi } from '@/vault/tauriClient'
import { EnvironmentBadge } from './EnvironmentBadge'
import { ConfirmDialog } from '@/components/common/Modal'
import { useToast } from '@/hooks/useToast'
import { copySecurely } from '@/vault/VaultContext'

interface Props {
  databases: DatabaseRecord[]
  onEdit: (d: DatabaseRecord) => void
  onChanged: () => void
}

export function DatabasesTable({ databases, onEdit, onChanged }: Props) {
  const { show } = useToast()
  const [toDelete, setToDelete] = useState<DatabaseRecord | null>(null)

  async function copyConnectionString(d: DatabaseRecord) {
    try {
      const secrets = await vaultApi.databasesReveal(d.id)
      if (!secrets.connection_string) {
        show('No connection string stored for this database', 'error')
        return
      }
      await copySecurely(secrets.connection_string)
      show('Copied securely')
    } catch (e) {
      show(String(e), 'error')
    }
  }

  async function copyAsDatabaseUrl(d: DatabaseRecord) {
    try {
      const secrets = await vaultApi.databasesReveal(d.id)
      if (!secrets.connection_string) {
        show('No connection string stored for this database', 'error')
        return
      }
      await copySecurely(`DATABASE_URL=${secrets.connection_string}`)
      show('Copied securely')
    } catch (e) {
      show(String(e), 'error')
    }
  }

  async function copyField(value: string | null | undefined, label: string) {
    if (!value) {
      show(`No ${label.toLowerCase()} stored`, 'error')
      return
    }
    await navigator.clipboard.writeText(value)
    show(`${label} copied`)
  }

  async function copyPassword(d: DatabaseRecord) {
    try {
      const secrets = await vaultApi.databasesReveal(d.id)
      if (!secrets.password) {
        show('No password stored for this database', 'error')
        return
      }
      await copySecurely(secrets.password)
      show('Copied securely')
    } catch (e) {
      show(String(e), 'error')
    }
  }

  async function remove() {
    if (!toDelete) return
    try {
      await vaultApi.databasesDelete(toDelete.id)
      show('Database credential deleted')
      onChanged()
    } catch (e) {
      show(String(e), 'error')
    } finally {
      setToDelete(null)
    }
  }

  if (databases.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-surface-500 bg-surface-200/50 px-6 py-10 text-center text-sm text-ink-500">
        No database credentials yet.
      </div>
    )
  }

  return (
    <div className="grid sm:grid-cols-2 gap-3.5">
      {databases.map((d) => (
        <div key={d.id} className="rounded-xl border border-surface-400 bg-surface-200 p-4 shadow-soft">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="grid place-items-center h-8 w-8 rounded-lg bg-surface-300 text-ink-400">
                <DbIcon size={15} />
              </div>
              <div>
                <h3 className="text-sm font-medium text-ink-100">{d.name}</h3>
                <p className="text-[11px] text-ink-500">{d.provider}</p>
              </div>
            </div>
            <EnvironmentBadge environment={d.environment} />
          </div>

          <dl className="text-xs space-y-1 mt-3">
            <Row label="Connection String" value={d.has_connection_string ? '••••••••••' : '—'} action={d.has_connection_string ? () => copyConnectionString(d) : undefined} />
            <Row label="Host" value={d.host || '—'} action={d.host ? () => copyField(d.host, 'Host') : undefined} />
            <Row label="Database" value={d.database_name || '—'} />
            <Row label="Username" value={d.username || '—'} action={d.username ? () => copyField(d.username, 'Username') : undefined} />
            <Row label="Password" value={d.has_password ? '••••••••••' : '—'} action={d.has_password ? () => copyPassword(d) : undefined} />
          </dl>

          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-surface-400">
            {d.has_connection_string && (
              <button onClick={() => copyAsDatabaseUrl(d)} className="text-[11px] font-medium text-accent-400 hover:text-accent-300 inline-flex items-center gap-1">
                <Copy size={11} /> Copy as DATABASE_URL
              </button>
            )}
            <div className="flex-1" />
            <button onClick={() => onEdit(d)} className="text-ink-500 hover:text-ink-100 transition-colors"><Pencil size={13} /></button>
            <button onClick={() => setToDelete(d)} className="text-ink-500 hover:text-rose-400 transition-colors"><Trash2 size={13} /></button>
          </div>
        </div>
      ))}

      <ConfirmDialog
        open={!!toDelete}
        title="Delete Database Credential?"
        message={`This permanently removes "${toDelete?.name}" from the local vault.`}
        confirmLabel="Delete"
        danger
        onConfirm={remove}
        onCancel={() => setToDelete(null)}
      />
    </div>
  )
}

function Row({ label, value, action }: { label: string; value: string; action?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-ink-500 shrink-0">{label}</dt>
      <dd className="flex items-center gap-1.5 min-w-0">
        <span className="text-ink-300 font-mono truncate">{value}</span>
        {action && (
          <button onClick={action} className="text-ink-500 hover:text-ink-100 shrink-0 transition-colors">
            <Copy size={11} />
          </button>
        )}
      </dd>
    </div>
  )
}
