import React, { useEffect, useState } from 'react'
import { Plus, Users, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/common/Button'
import { EmptyState } from '@/components/common/EmptyState'
import { Modal, ConfirmDialog } from '@/components/common/Modal'
import { Input } from '@/components/common/Input'
import { useClients as useLegacyClients } from '@/hooks/useStore'
import { useToast } from '@/hooks/useToast'
import { formatINR } from '@/utils/format'
import { uid } from '@/utils/storage'
import { coreApi, isDesktop } from '@/data/coreClient'
import type { Client as DbClient, NewClient } from '@/data/coreTypes'

function friendlyError(e: unknown): string {
  console.error(e)
  return 'Something went wrong. Please try again.'
}

export default function Clients() {
  const desktop = isDesktop()
  const [legacyClients, setLegacyClients] = useLegacyClients()

  const [dbClients, setDbClients] = useState<DbClient[]>([])
  const [loading, setLoading] = useState(desktop)
  const [error, setError] = useState<string | null>(null)

  const { show } = useToast()
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ name: '', company: '', email: '', phone: '' })
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null)

  async function reload() {
    if (!desktop) return
    setLoading(true)
    setError(null)
    try {
      setDbClients(await coreApi.clientsList())
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!form.company.trim()) return

    if (desktop) {
      const input: NewClient = {
        name: form.name.trim() || null,
        company: form.company.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        address: null,
        website: null,
        gstin: null,
        notes: null,
      } as unknown as NewClient
      try {
        await coreApi.clientsCreate(input)
        show('Client added')
        setShowNew(false)
        setForm({ name: '', company: '', email: '', phone: '' })
        reload()
      } catch (e) {
        show(friendlyError(e), 'error')
      }
      return
    }

    setLegacyClients([{ id: uid('cli'), ...form, projects: 0, totalInvoiced: 0 }, ...legacyClients])
    show('Client added')
    setShowNew(false)
    setForm({ name: '', company: '', email: '', phone: '' })
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    if (desktop) {
      try {
        await coreApi.clientsDelete(deleteTarget.id)
        show('Client deleted')
        setDeleteTarget(null)
        reload()
      } catch (e) {
        show(friendlyError(e), 'error')
      }
    } else {
      setLegacyClients(legacyClients.filter((c) => c.id !== deleteTarget.id))
      show('Client deleted')
      setDeleteTarget(null)
    }
  }

  const rows = desktop
    ? dbClients.map((c) => ({ id: c.id, name: c.name || '', company: c.company || '', email: c.email || '', phone: c.phone || '', projects: null as number | null, totalInvoiced: null as number | null }))
    : legacyClients.map((c) => ({ id: c.id, name: c.name, company: c.company, email: c.email, phone: c.phone, projects: c.projects, totalInvoiced: c.totalInvoiced }))

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle="Everyone you work with, in one place."
        actions={<Button icon={<Plus size={15} />} onClick={() => setShowNew(true)}>Add Client</Button>}
      />

      {!desktop && (
        <div className="mb-4 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-400">
          Demo data — open this app in Desktop Mode to save clients permanently.
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-11 rounded-lg border border-surface-400 bg-surface-200 animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={Users} title="No clients yet" description="Add your first client to start tracking projects and invoices." />
      ) : (
        <div className="rounded-xl border border-surface-400 bg-surface-200 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-medium text-ink-500 uppercase tracking-wide bg-surface-300 border-b border-surface-400">
                <th className="px-4 py-2.5">Client</th>
                <th className="px-4 py-2.5">Company</th>
                <th className="px-4 py-2.5">Email</th>
                <th className="px-4 py-2.5">Phone</th>
                {!desktop && <th className="px-4 py-2.5 text-right">Projects</th>}
                {!desktop && <th className="px-4 py-2.5 text-right">Total Invoiced</th>}
                <th className="px-4 py-2.5 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-400">
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-surface-300/50 transition-colors group">
                  <td className="px-4 py-3 font-medium text-ink-100">{c.name || '—'}</td>
                  <td className="px-4 py-3 text-ink-300">{c.company}</td>
                  <td className="px-4 py-3 text-ink-400">{c.email || '—'}</td>
                  <td className="px-4 py-3 text-ink-400">{c.phone || '—'}</td>
                  {!desktop && <td className="px-4 py-3 text-right text-ink-300 tabular-nums">{c.projects}</td>}
                  {!desktop && <td className="px-4 py-3 text-right text-ink-100 tabular-nums">{formatINR(c.totalInvoiced || 0)}</td>}
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setDeleteTarget({ id: c.id, label: c.company || c.name || 'this client' })}
                      className="text-ink-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete client"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showNew} onClose={() => setShowNew(false)} title="Add Client">
        <form onSubmit={create} className="space-y-3">
          <Input label="Contact name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Company" required value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={() => setShowNew(false)} className="rounded-lg border border-surface-500 bg-surface-300 px-3.5 py-2 text-sm text-ink-100 hover:bg-surface-400 transition-colors">
              Cancel
            </button>
            <Button type="submit">Add Client</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete client"
        message={`Delete ${deleteTarget?.label}? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
