import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, FileText, Wallet, Clock, AlertTriangle } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/common/Button'
import { StatCard } from '@/components/common/StatCard'
import { EmptyState } from '@/components/common/EmptyState'
import { ConfirmDialog } from '@/components/common/Modal'
import { InvoiceTable } from '@/components/invoices/InvoiceTable'
import { useInvoices as useLegacyInvoices } from '@/hooks/useStore'
import { useToast } from '@/hooks/useToast'
import { computeInvoiceTotals } from '@/utils/invoice'
import { formatINR, formatDate, todayISO } from '@/utils/format'
import { Invoice, InvoiceStatus } from '@/types'
import { uid } from '@/utils/storage'
import { coreApi, isDesktop } from '@/data/coreClient'
import type { Invoice as DbInvoice } from '@/data/coreTypes'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Eye, Pencil, Copy, Printer, Trash2 } from 'lucide-react'

const statusFilters: ('All' | InvoiceStatus)[] = ['All', 'Draft', 'Sent', 'Paid', 'Overdue']

function friendlyError(e: unknown): string {
  console.error(e)
  return 'Something went wrong. Please try again.'
}

export default function Invoices() {
  const desktop = isDesktop()
  const { show } = useToast()
  const navigate = useNavigate()

  // ---- legacy (browser demo mode) ----
  const [legacyInvoices, setLegacyInvoices] = useLegacyInvoices()
  const [statusFilter, setStatusFilter] = useState<'All' | InvoiceStatus>('All')
  const [toDelete, setToDelete] = useState<Invoice | null>(null)

  const legacyTotals = useMemo(() => {
    let total = 0, paid = 0, pending = 0, overdue = 0
    legacyInvoices.forEach((inv) => {
      const amt = computeInvoiceTotals(inv).grandTotal
      total += amt
      if (inv.status === 'Paid') paid += amt
      else if (inv.status === 'Overdue') overdue += amt
      else pending += amt
    })
    return { total, paid, pending, overdue }
  }, [legacyInvoices])

  const legacyFiltered = statusFilter === 'All' ? legacyInvoices : legacyInvoices.filter((i) => i.status === statusFilter)
  const legacySorted = [...legacyFiltered].sort((a, b) => +new Date(b.issueDate) - +new Date(a.issueDate))

  function duplicateLegacy(inv: Invoice) {
    const now = todayISO()
    const copy: Invoice = {
      ...inv,
      id: uid('inv'),
      invoiceNumber: nextInvoiceNumber(legacyInvoices),
      status: 'Draft',
      issueDate: now,
      items: inv.items.map((i) => ({ ...i, id: uid('item') })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setLegacyInvoices([copy, ...legacyInvoices])
    show('Invoice duplicated')
  }

  function removeLegacy() {
    if (!toDelete) return
    setLegacyInvoices(legacyInvoices.filter((i) => i.id !== toDelete.id))
    show('Invoice deleted')
    setToDelete(null)
  }

  // ---- desktop (real backend) ----
  const [dbInvoices, setDbInvoices] = useState<DbInvoice[]>([])
  const [loading, setLoading] = useState(desktop)
  const [error, setError] = useState<string | null>(null)
  const [dbStatusFilter, setDbStatusFilter] = useState<'All' | string>('All')
  const [dbToDelete, setDbToDelete] = useState<DbInvoice | null>(null)

  async function reload() {
    if (!desktop) return
    setLoading(true)
    setError(null)
    try {
      setDbInvoices(await coreApi.invoicesList())
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

  const dbTotals = useMemo(() => {
    let total = 0, paid = 0, pending = 0, overdue = 0
    dbInvoices.forEach((inv) => {
      total += inv.total
      if (inv.status === 'Paid') paid += inv.total
      else if (inv.status === 'Overdue') overdue += inv.total
      else pending += inv.total
    })
    return { total, paid, pending, overdue }
  }, [dbInvoices])

  const dbFiltered = dbStatusFilter === 'All' ? dbInvoices : dbInvoices.filter((i) => i.status === dbStatusFilter)
  const dbSorted = [...dbFiltered].sort((a, b) => +new Date(b.issue_date) - +new Date(a.issue_date))

  async function duplicateDb(inv: DbInvoice) {
    try {
      await coreApi.invoicesDuplicate(inv.id)
      show('Invoice duplicated')
      reload()
    } catch (e) {
      show(friendlyError(e), 'error')
    }
  }
  async function removeDb() {
    if (!dbToDelete) return
    try {
      await coreApi.invoicesDelete(dbToDelete.id)
      show('Invoice deleted')
      setDbToDelete(null)
      reload()
    } catch (e) {
      show(friendlyError(e), 'error')
    }
  }

  const totals = desktop ? dbTotals : legacyTotals

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

      {!desktop && (
        <div className="mb-4 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-400">
          Demo data — open this app in Desktop Mode to save invoices and payments permanently.
        </div>
      )}
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

      <div className="flex items-center gap-1 rounded-lg border border-surface-500 bg-surface-300 p-1 w-fit mb-4">
        {(desktop ? ['All', 'Draft', 'Sent', 'Paid', 'Partially Paid', 'Overdue', 'Cancelled'] : statusFilters).map((f) => (
          <button
            key={f}
            onClick={() => (desktop ? setDbStatusFilter(f) : setStatusFilter(f as any))}
            className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              (desktop ? dbStatusFilter : statusFilter) === f ? 'bg-accent-500 text-white' : 'text-ink-400 hover:text-ink-100'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {desktop ? (
        loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => <div key={i} className="h-11 rounded-lg border border-surface-400 bg-surface-200 animate-pulse" />)}
          </div>
        ) : dbSorted.length === 0 ? (
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
                  {dbSorted.map((inv) => (
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
                          <IconBtn title="Duplicate" onClick={() => duplicateDb(inv)}><Copy size={14} /></IconBtn>
                          <IconBtn title="Print" onClick={() => navigate(`/invoices/${inv.id}?print=1`)}><Printer size={14} /></IconBtn>
                          <IconBtn title="Delete" danger onClick={() => setDbToDelete(inv)}><Trash2 size={14} /></IconBtn>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : legacySorted.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No invoices yet"
          description="Create your first invoice to get started."
          action={<Button size="sm" icon={<Plus size={14} />} onClick={() => navigate('/invoices/new')}>Create Invoice</Button>}
        />
      ) : (
        <InvoiceTable invoices={legacySorted} onDuplicate={duplicateLegacy} onDelete={(inv) => setToDelete(inv)} />
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Delete Invoice"
        message={`Delete invoice ${toDelete?.invoiceNumber}? This can't be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={removeLegacy}
        onCancel={() => setToDelete(null)}
      />
      <ConfirmDialog
        open={!!dbToDelete}
        title="Delete Invoice"
        message={`Delete invoice ${dbToDelete?.invoice_number}? This can't be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={removeDb}
        onCancel={() => setDbToDelete(null)}
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

export function nextInvoiceNumber(invoices: Invoice[]): string {
  const year = new Date().getFullYear()
  const nums = invoices
    .map((i) => i.invoiceNumber.match(/NF-(\d{4})-(\d+)/))
    .filter(Boolean)
    .map((m) => Number(m![2]))
  const next = (nums.length ? Math.max(...nums) : 0) + 1
  return `NF-${year}-${String(next).padStart(3, '0')}`
}
