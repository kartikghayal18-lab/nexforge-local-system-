import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, FileText, Wallet, Clock, AlertTriangle, Eye, Pencil, Copy, Printer, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/common/Button'
import { StatCard } from '@/components/common/StatCard'
import { EmptyState } from '@/components/common/EmptyState'
import { ConfirmDialog } from '@/components/common/Modal'
import { useToast } from '@/hooks/useToast'
import { formatINR, formatDate } from '@/utils/format'
import { coreApi } from '@/data/coreClient'
import type { Invoice as DbInvoice } from '@/data/coreTypes'
import { StatusBadge } from '@/components/common/StatusBadge'

const statusFilters = ['All', 'Draft', 'Sent', 'Paid', 'Partially Paid', 'Overdue', 'Cancelled']

function friendlyError(e: unknown): string {
  console.error(e)
  return e instanceof Error ? e.message : 'Something went wrong. Please try again.'
}

export default function Invoices() {
  const { show } = useToast()
  const navigate = useNavigate()

  const [invoices, setInvoices] = useState<DbInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'All' | string>('All')
  const [toDelete, setToDelete] = useState<DbInvoice | null>(null)

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      setInvoices(await coreApi.invoicesList())
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    reload()
  }, [])

  const totals = useMemo(() => {
    let total = 0, paid = 0, pending = 0, overdue = 0
    invoices.forEach((inv) => {
      total += inv.total
      if (inv.status === 'Paid') paid += inv.total
      else if (inv.status === 'Overdue') overdue += inv.total
      else pending += inv.total
    })
    return { total, paid, pending, overdue }
  }, [invoices])

  const filtered = statusFilter === 'All' ? invoices : invoices.filter((i) => i.status === statusFilter)
  const sorted = [...filtered].sort((a, b) => +new Date(b.issue_date) - +new Date(a.issue_date))

  async function duplicate(inv: DbInvoice) {
    try {
      await coreApi.invoicesDuplicate(inv.id)
      show('Invoice duplicated')
      reload()
    } catch (e) {
      show(friendlyError(e), 'error')
    }
  }
  async function remove() {
    if (!toDelete) return
    try {
      await coreApi.invoicesDelete(toDelete.id)
      show('Invoice deleted')
      setToDelete(null)
      reload()
    } catch (e) {
      show(friendlyError(e), 'error')
    }
  }

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle="Create, manage and export professional invoices."
        actions={
          <Button icon={<Plus size={15} />} onClick={() => navigate('/invoices/new')}>
            Create Invoice
          </Button>
        }
      />

      {error && (
        <div className="mb-4 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard label="Total Invoiced" value={formatINR(totals.total)} icon={FileText} tone="accent" />
        <StatCard label="Paid" value={formatINR(totals.paid)} icon={Wallet} tone="emerald" />
        <StatCard label="Pending" value={formatINR(totals.pending)} icon={Clock} tone="amber" />
        <StatCard label="Overdue" value={formatINR(totals.overdue)} icon={AlertTriangle} tone="rose" />
      </div>

      <div className="flex items-center gap-1 rounded-lg border border-surface-500 bg-surface-300 p-1 w-fit mb-4 overflow-x-auto">
        {statusFilters.map((f) => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
              statusFilter === f ? 'bg-accent-500 text-white' : 'text-ink-400 hover:text-ink-100'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <div key={i} className="h-11 rounded-lg border border-surface-400 bg-surface-200 animate-pulse" />)}
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No invoices yet"
          description="Create your first invoice to get started."
          action={<Button size="sm" icon={<Plus size={14} />} onClick={() => navigate('/invoices/new')}>Create Invoice</Button>}
        />
      ) : (
        <div className="rounded-xl border border-surface-400 bg-surface-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-medium text-ink-500 uppercase tracking-wide bg-surface-300 border-b border-surface-400">
                  <th className="px-4 py-2.5">Invoice #</th>
                  <th className="px-4 py-2.5">Issue Date</th>
                  <th className="px-4 py-2.5">Due Date</th>
                  <th className="px-4 py-2.5 text-right">Amount</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-400">
                {sorted.map((inv) => (
                  <tr key={inv.id} className="hover:bg-surface-300/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-ink-100">{inv.invoice_number}</td>
                    <td className="px-4 py-3 text-ink-400">{formatDate(inv.issue_date)}</td>
                    <td className="px-4 py-3 text-ink-400">{formatDate(inv.due_date)}</td>
                    <td className="px-4 py-3 text-right text-ink-100 tabular-nums">{formatINR(inv.total)}</td>
                    <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <IconBtn title="View" onClick={() => navigate(`/invoices/${inv.id}`)}><Eye size={14} /></IconBtn>
                        <IconBtn title="Edit" onClick={() => navigate(`/invoices/${inv.id}/edit`)}><Pencil size={14} /></IconBtn>
                        <IconBtn title="Duplicate" onClick={() => duplicate(inv)}><Copy size={14} /></IconBtn>
                        <IconBtn title="Print" onClick={() => navigate(`/invoices/${inv.id}?print=1`)}><Printer size={14} /></IconBtn>
                        <IconBtn title="Delete" danger onClick={() => setToDelete(inv)}><Trash2 size={14} /></IconBtn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Delete Invoice"
        message={`Delete invoice ${toDelete?.invoice_number}? This can't be undone.`}
        confirmLabel="Delete"
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
