import React, { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Pencil, Printer, Send, CheckCircle2, Copy, Wallet, Trash2, FileDown } from 'lucide-react'
import { Button } from '@/components/common/Button'
import { StatusBadge } from '@/components/common/StatusBadge'
import { InvoicePreview } from '@/components/invoices/InvoicePreview'
import { InvoicePreviewCore } from '@/components/invoices/InvoicePreviewCore'
import { Modal, ConfirmDialog } from '@/components/common/Modal'
import { Input, Select, TextArea } from '@/components/common/Input'
import { useInvoices as useLegacyInvoices } from '@/hooks/useStore'
import { useToast } from '@/hooks/useToast'
import { uid } from '@/utils/storage'
import { formatINR, formatDate, todayISO } from '@/utils/format'
import { nextInvoiceNumber } from './Invoices'
import { coreApi, isDesktop } from '@/data/coreClient'
import type { Invoice as DbInvoice, Client, Payment, NewPayment } from '@/data/coreTypes'

function friendlyError(e: unknown): string {
  console.error(e)
  return 'Something went wrong. Please try again.'
}

export default function InvoiceView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { show } = useToast()
  const desktop = isDesktop()

  // ---------------- Legacy (browser demo) ----------------
  const [legacyInvoices, setLegacyInvoices] = useLegacyInvoices()
  const invoice = legacyInvoices.find((i) => i.id === id)

  useEffect(() => {
    if (!desktop && params.get('print') === '1' && invoice) {
      const t = setTimeout(() => window.print(), 250)
      return () => clearTimeout(t)
    }
  }, [params, invoice, desktop])

  function setLegacyStatus(status: typeof invoice extends undefined ? never : any) {
    setLegacyInvoices(legacyInvoices.map((i) => (i.id === invoice!.id ? { ...i, status, updatedAt: new Date().toISOString() } : i)))
    show(`Invoice marked as ${status}`)
  }
  function duplicateLegacy() {
    const copy = {
      ...invoice!,
      id: uid('inv'),
      invoiceNumber: nextInvoiceNumber(legacyInvoices),
      status: 'Draft' as const,
      issueDate: todayISO(),
      items: invoice!.items.map((i) => ({ ...i, id: uid('item') })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setLegacyInvoices([copy, ...legacyInvoices])
    show('Invoice duplicated')
    navigate(`/invoices/${copy.id}/edit`)
  }

  // ---------------- Desktop (real backend) ----------------
  const [dbInvoice, setDbInvoice] = useState<DbInvoice | null>(null)
  const [client, setClient] = useState<Client | null>(null)
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(desktop)
  const [notFound, setNotFound] = useState(false)
  const [paymentModal, setPaymentModal] = useState(false)
  const [paymentForm, setPaymentForm] = useState({ amount: 0, payment_date: todayISO(), payment_method: '', reference: '', notes: '' })
  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null)

  async function load() {
    if (!desktop || !id) return
    setLoading(true)
    try {
      const inv = await coreApi.invoicesGet(id)
      setDbInvoice(inv)
      const [clients, pays] = await Promise.all([coreApi.clientsList(), coreApi.paymentsList(id)])
      setClient(clients.find((c) => c.id === inv.client_id) || null)
      setPayments(pays)
    } catch (e) {
      setNotFound(true)
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, desktop])

  useEffect(() => {
    if (desktop && params.get('print') === '1' && dbInvoice) {
      const t = setTimeout(() => window.print(), 250)
      return () => clearTimeout(t)
    }
  }, [params, dbInvoice, desktop])

  async function setDbStatus(status: string) {
    if (!dbInvoice) return
    try {
      await coreApi.invoicesSetStatus(dbInvoice.id, status)
      show(`Invoice marked as ${status}`)
      load()
    } catch (e) {
      show(friendlyError(e), 'error')
    }
  }
  async function duplicateDb() {
    if (!dbInvoice) return
    try {
      const newId = await coreApi.invoicesDuplicate(dbInvoice.id)
      show('Invoice duplicated')
      navigate(`/invoices/${newId}/edit`)
    } catch (e) {
      show(friendlyError(e), 'error')
    }
  }
  async function recordPayment(e: React.FormEvent) {
    e.preventDefault()
    if (!dbInvoice || paymentForm.amount <= 0) return
    const input: NewPayment = {
      invoice_id: dbInvoice.id,
      amount: paymentForm.amount,
      payment_date: paymentForm.payment_date,
      payment_method: paymentForm.payment_method || null,
      reference: paymentForm.reference || null,
      notes: paymentForm.notes || null,
    }
    try {
      await coreApi.paymentsCreate(input)
      show('Payment recorded')
      setPaymentModal(false)
      setPaymentForm({ amount: 0, payment_date: todayISO(), payment_method: '', reference: '', notes: '' })
      load()
    } catch (e) {
      show(friendlyError(e), 'error')
    }
  }
  async function confirmDeletePayment() {
    if (!deletePaymentId) return
    try {
      await coreApi.paymentsDelete(deletePaymentId)
      show('Payment removed')
      setDeletePaymentId(null)
      load()
    } catch (e) {
      show(friendlyError(e), 'error')
    }
  }

  // ============================= RENDER =============================

  if (!desktop) {
    if (!invoice) {
      return (
        <div className="text-center py-20">
          <p className="text-sm text-ink-400">Invoice not found.</p>
          <button onClick={() => navigate('/invoices')} className="mt-3 text-sm text-accent-400 hover:text-accent-300">
            Back to Invoices
          </button>
        </div>
      )
    }
    return (
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-5 no-print flex-wrap gap-2">
          <button onClick={() => navigate('/invoices')} className="inline-flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-100 transition-colors">
            <ArrowLeft size={14} /> Back to Invoices
          </button>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <StatusBadge status={invoice.status} />
            <Button variant="secondary" size="sm" icon={<Send size={13} />} onClick={() => setLegacyStatus('Sent')}>Mark as Sent</Button>
            <Button variant="secondary" size="sm" icon={<CheckCircle2 size={13} />} onClick={() => setLegacyStatus('Paid')}>Mark as Paid</Button>
            <Button variant="secondary" size="sm" icon={<Copy size={13} />} onClick={duplicateLegacy}>Duplicate</Button>
            <Button variant="secondary" size="sm" icon={<Pencil size={13} />} onClick={() => navigate(`/invoices/${invoice.id}/edit`)}>Edit</Button>
            <Button size="sm" icon={<Printer size={13} />} onClick={() => window.print()}>Print / PDF</Button>
          </div>
        </div>
        <div className="mb-4 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-400 no-print">
          Demo data — open this app in Desktop Mode for real persistence and payments.
        </div>
        <InvoicePreview invoice={invoice} />
      </div>
    )
  }

  if (loading) {
    return <div className="max-w-3xl mx-auto h-64 rounded-xl border border-surface-400 bg-surface-200 animate-pulse" />
  }
  if (notFound || !dbInvoice) {
    return (
      <div className="text-center py-20">
        <p className="text-sm text-ink-400">Invoice not found.</p>
        <button onClick={() => navigate('/invoices')} className="mt-3 text-sm text-accent-400 hover:text-accent-300">
          Back to Invoices
        </button>
      </div>
    )
  }

  const remaining = Math.max(dbInvoice.total - dbInvoice.amount_paid, 0)
  const taxRatePercent = dbInvoice.subtotal - dbInvoice.discount > 0
    ? Math.round((dbInvoice.tax / (dbInvoice.subtotal - dbInvoice.discount)) * 10000) / 100
    : 0


  async function exportPdf() {
    if (!dbInvoice) return
    try {
      const blob = await coreApi.invoicesFetchPdfBlob(dbInvoice.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${dbInvoice.invoice_number}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      show('Invoice PDF downloaded')
    } catch (e) {
      show(String(e), 'error')
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5 no-print flex-wrap gap-2">
        <button onClick={() => navigate('/invoices')} className="inline-flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-100 transition-colors">
          <ArrowLeft size={14} /> Back to Invoices
        </button>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <StatusBadge status={dbInvoice.status} />
          <Button variant="secondary" size="sm" icon={<Send size={13} />} onClick={() => setDbStatus('Sent')}>Mark as Sent</Button>
          <Button variant="secondary" size="sm" icon={<CheckCircle2 size={13} />} onClick={() => setDbStatus('Paid')}>Mark as Paid</Button>
          <Button variant="secondary" size="sm" icon={<Wallet size={13} />} onClick={() => setPaymentModal(true)}>Record Payment</Button>
          <Button variant="secondary" size="sm" icon={<Copy size={13} />} onClick={duplicateDb}>Duplicate</Button>
          <Button variant="secondary" size="sm" icon={<Pencil size={13} />} onClick={() => navigate(`/invoices/${dbInvoice.id}/edit`)}>Edit</Button>
          <Button size="sm" variant="secondary" icon={<Printer size={13} />} onClick={() => window.print()}>Print</Button>
          <Button size="sm" icon={<FileDown size={13} />} onClick={exportPdf}>Export PDF</Button>
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-surface-400 bg-surface-200 px-4 py-3 flex items-center justify-between text-sm no-print">
        <span className="text-ink-400">Amount Paid: <span className="text-ink-100 font-medium">{formatINR(dbInvoice.amount_paid)}</span></span>
        <span className="text-ink-400">Balance Due: <span className={`font-semibold ${remaining > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{formatINR(remaining)}</span></span>
      </div>

      <InvoicePreviewCore
        data={{
          invoiceNumber: dbInvoice.invoice_number,
          issueDate: dbInvoice.issue_date,
          dueDate: dbInvoice.due_date,
          paymentTerms: dbInvoice.payment_terms,
          currency: dbInvoice.currency,
          items: dbInvoice.items.map((it) => ({ description: it.description, quantity: it.quantity, rate: it.rate })),
          discount: dbInvoice.discount,
          taxRatePercent,
          notes: dbInvoice.notes,
          status: dbInvoice.status,
        }}
        client={client}
      />

      <section className="mt-5 rounded-xl border border-surface-400 bg-surface-200 p-4 no-print">
        <h2 className="text-sm font-semibold text-ink-100 mb-3">Payment History</h2>
        {payments.length === 0 ? (
          <p className="text-sm text-ink-600">No payments recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm rounded-lg border border-surface-400 px-3 py-2 group">
                <div>
                  <span className="text-ink-100 font-medium">{formatINR(p.amount)}</span>
                  <span className="text-ink-500 ml-2">{formatDate(p.payment_date)}</span>
                  {p.payment_method && <span className="text-ink-500 ml-2">· {p.payment_method}</span>}
                </div>
                <button onClick={() => setDeletePaymentId(p.id)} className="text-ink-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <Modal open={paymentModal} onClose={() => setPaymentModal(false)} title="Record Payment">
        <form onSubmit={recordPayment} className="space-y-3">
          <Input type="number" min={0.01} step="0.01" label={`Amount (balance due: ${formatINR(remaining)})`} required value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })} />
          <Input type="date" label="Payment Date" value={paymentForm.payment_date} onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })} />
          <Select label="Method" value={paymentForm.payment_method} onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}>
            <option value="">Select method…</option>
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="UPI">UPI</option>
            <option value="Cash">Cash</option>
            <option value="Card">Card</option>
            <option value="Other">Other</option>
          </Select>
          <Input label="Reference (optional)" value={paymentForm.reference} onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })} />
          <TextArea label="Notes (optional)" rows={2} value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} />
          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={() => setPaymentModal(false)} className="rounded-lg border border-surface-500 bg-surface-300 px-3.5 py-2 text-sm text-ink-100 hover:bg-surface-400 transition-colors">
              Cancel
            </button>
            <Button type="submit">Record Payment</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deletePaymentId}
        title="Remove Payment"
        message="Remove this payment record? The invoice status may revert accordingly."
        confirmLabel="Remove"
        danger
        onConfirm={confirmDeletePayment}
        onCancel={() => setDeletePaymentId(null)}
      />
    </div>
  )
}
