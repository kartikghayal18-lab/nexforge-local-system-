import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, Send, CheckCircle2, Printer } from 'lucide-react'
import { Button } from '@/components/common/Button'
import { InvoiceForm } from '@/components/invoices/InvoiceForm'
import { InvoicePreview } from '@/components/invoices/InvoicePreview'
import { InvoiceFormCore, CoreInvoiceFormState } from '@/components/invoices/InvoiceFormCore'
import { InvoicePreviewCore } from '@/components/invoices/InvoicePreviewCore'
import { useInvoices as useLegacyInvoices } from '@/hooks/useStore'
import { useToast } from '@/hooks/useToast'
import { Invoice, InvoiceStatus } from '@/types'
import { uid } from '@/utils/storage'
import { DEFAULT_PAYMENT_DETAILS, NEXFORGE_PROFILE } from '@/data/seed'
import { nextInvoiceNumber } from './Invoices'
import { coreApi, isDesktop } from '@/data/coreClient'
import type { Client, ProjectFull, NewInvoice, UpdateInvoice } from '@/data/coreTypes'
import { todayISO } from '@/utils/format'

function blankInvoice(invoiceNumber: string): Invoice {
  const now = new Date().toISOString()
  return {
    id: uid('inv'),
    invoiceNumber,
    issueDate: now.slice(0, 10),
    dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    paymentTerms: 'Net 14 Days',
    from: {
      name: NEXFORGE_PROFILE.name,
      address: NEXFORGE_PROFILE.address,
      city: NEXFORGE_PROFILE.city,
      state: NEXFORGE_PROFILE.state,
      pin: NEXFORGE_PROFILE.pin,
      country: NEXFORGE_PROFILE.country,
      phone: NEXFORGE_PROFILE.phone,
      email: NEXFORGE_PROFILE.email,
      website: NEXFORGE_PROFILE.website,
      gstin: NEXFORGE_PROFILE.gstin,
    },
    billTo: {
      name: '',
      contactPerson: '',
      address: '',
      city: '',
      state: '',
      pin: '',
      country: 'India',
      phone: '',
      email: '',
      gstin: '',
    },
    items: [{ id: uid('item'), description: '', quantity: 1, rate: 0 }],
    discountType: 'percentage',
    discountValue: 0,
    gstMode: 'CGST_SGST',
    gstPercentage: 9,
    additionalCharge: 0,
    additionalChargeLabel: 'Additional Charge',
    notes: 'Payment is due within 14 days.\nPlease include the invoice number in your payment reference.\nThank you for your business.',
    terms: 'Late payments may attract a 2% monthly interest. Work products remain the property of Nexforge Studios until final payment is received.',
    payment: DEFAULT_PAYMENT_DETAILS,
    status: 'Draft',
    createdAt: now,
    updatedAt: now,
  }
}

function friendlyError(e: unknown): string {
  console.error(e)
  return 'Something went wrong. Please try again.'
}

function blankCoreForm(): CoreInvoiceFormState {
  return {
    client_id: null,
    project_id: null,
    issue_date: todayISO(),
    due_date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    status: 'Draft',
    currency: 'INR',
    discount: 0,
    tax_rate_percent: 9,
    notes: '',
    payment_terms: 'Net 14 Days',
    items: [{ description: '', quantity: 1, rate: 0 }],
  }
}

export default function InvoiceEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { show } = useToast()
  const desktop = isDesktop()
  const isNew = !id

  // ---------------- Legacy (browser demo) ----------------
  const [legacyInvoices, setLegacyInvoices] = useLegacyInvoices()
  const existing = id ? legacyInvoices.find((i) => i.id === id) : undefined
  const [invoice, setInvoice] = useState<Invoice>(() => existing ?? blankInvoice(nextInvoiceNumber(legacyInvoices)))

  function patch(p: Partial<Invoice>) {
    setInvoice((prev) => ({ ...prev, ...p }))
  }

  function persist(status?: InvoiceStatus, silent = false) {
    const toSave: Invoice = { ...invoice, status: status ?? invoice.status, updatedAt: new Date().toISOString() }
    setInvoice(toSave)
    setLegacyInvoices((prev) => {
      const exists = prev.some((i) => i.id === toSave.id)
      return exists ? prev.map((i) => (i.id === toSave.id ? toSave : i)) : [toSave, ...prev]
    })
    if (!silent) show(status ? `Invoice marked as ${status}` : 'Draft saved')
    return toSave
  }

  function saveDraft() {
    persist('Draft')
    navigate('/invoices')
  }
  function markSent() {
    persist('Sent')
    navigate(`/invoices/${invoice.id}`)
  }
  function markPaid() {
    persist('Paid')
    navigate(`/invoices/${invoice.id}`)
  }
  function saveAndPrint() {
    const saved = persist(undefined, true)
    navigate(`/invoices/${saved.id}?print=1`)
  }

  // ---------------- Desktop (real backend) ----------------
  const [clients, setClients] = useState<Client[]>([])
  const [projects, setProjects] = useState<ProjectFull[]>([])
  const [form, setForm] = useState<CoreInvoiceFormState>(blankCoreForm())
  const [invoiceNumber, setInvoiceNumber] = useState<string>('')
  const [loading, setLoading] = useState(desktop)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!desktop) return
    ;(async () => {
      setLoading(true)
      try {
        const [c, p] = await Promise.all([coreApi.clientsList(), coreApi.projectsList()])
        setClients(c)
        setProjects(p)
        if (id) {
          const inv = await coreApi.invoicesGet(id)
          setInvoiceNumber(inv.invoice_number)
          setForm({
            client_id: inv.client_id,
            project_id: inv.project_id,
            issue_date: inv.issue_date,
            due_date: inv.due_date,
            status: inv.status,
            currency: inv.currency,
            discount: inv.discount,
            tax_rate_percent: inv.tax > 0 && inv.subtotal - inv.discount > 0 ? Math.round((inv.tax / (inv.subtotal - inv.discount)) * 10000) / 100 : 0,
            notes: inv.notes || '',
            payment_terms: inv.payment_terms || '',
            items: inv.items.map((it) => ({ description: it.description, quantity: it.quantity, rate: it.rate })),
          })
        }
      } catch (e) {
        show(friendlyError(e), 'error')
      } finally {
        setLoading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desktop, id])

  function patchCore(p: Partial<CoreInvoiceFormState>) {
    setForm((prev) => ({ ...prev, ...p }))
  }

  async function saveCore(status?: string, navigateAfter?: (savedId: string) => void) {
    setSaving(true)
    try {
      const payload = {
        client_id: form.client_id,
        project_id: form.project_id,
        issue_date: form.issue_date,
        due_date: form.due_date,
        status: status ?? form.status,
        currency: form.currency,
        discount: form.discount,
        tax_rate_percent: form.tax_rate_percent,
        notes: form.notes || null,
        payment_terms: form.payment_terms || null,
        items: form.items.filter((it) => it.description.trim().length > 0 || it.rate > 0),
      }
      let savedId = id
      if (id) {
        const input: UpdateInvoice = { id, ...payload }
        await coreApi.invoicesUpdate(input)
      } else {
        const input: NewInvoice = payload
        savedId = await coreApi.invoicesCreate(input)
      }
      show(status ? `Invoice marked as ${status}` : 'Invoice saved')
      if (savedId && navigateAfter) navigateAfter(savedId)
    } catch (e) {
      show(friendlyError(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  const selectedClient = useMemo(() => clients.find((c) => c.id === form.client_id) || null, [clients, form.client_id])

  if (!desktop) {
    return (
      <div>
        <div className="flex items-center justify-between mb-5 no-print">
          <button onClick={() => navigate('/invoices')} className="inline-flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-100 transition-colors">
            <ArrowLeft size={14} /> Back to Invoices
          </button>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Button variant="secondary" size="sm" icon={<Save size={13} />} onClick={saveDraft}>Save Draft</Button>
            <Button variant="secondary" size="sm" icon={<Send size={13} />} onClick={markSent}>Mark as Sent</Button>
            <Button variant="secondary" size="sm" icon={<CheckCircle2 size={13} />} onClick={markPaid}>Mark as Paid</Button>
            <Button size="sm" icon={<Printer size={13} />} onClick={saveAndPrint}>Print / PDF</Button>
          </div>
        </div>
        <div className="mb-4 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-400 no-print">
          Demo data — open this app in Desktop Mode to save invoices permanently.
        </div>
        <div className="grid lg:grid-cols-2 gap-5 items-start">
          <div className="no-print">
            <InvoiceForm invoice={invoice} onChange={patch} />
          </div>
          <div className="lg:sticky lg:top-6">
            <InvoicePreview invoice={invoice} />
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return <div className="h-40 rounded-xl border border-surface-400 bg-surface-200 animate-pulse" />
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5 no-print flex-wrap gap-2">
        <button onClick={() => navigate('/invoices')} className="inline-flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-100 transition-colors">
          <ArrowLeft size={14} /> Back to Invoices
        </button>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Button variant="secondary" size="sm" icon={<Save size={13} />} disabled={saving} onClick={() => saveCore('Draft', () => navigate('/invoices'))}>Save Draft</Button>
          <Button variant="secondary" size="sm" icon={<Send size={13} />} disabled={saving} onClick={() => saveCore('Sent', (sid) => navigate(`/invoices/${sid}`))}>Mark as Sent</Button>
          <Button variant="secondary" size="sm" icon={<CheckCircle2 size={13} />} disabled={saving} onClick={() => saveCore('Paid', (sid) => navigate(`/invoices/${sid}`))}>Mark as Paid</Button>
          <Button size="sm" icon={<Printer size={13} />} disabled={saving} onClick={() => saveCore(undefined, (sid) => navigate(`/invoices/${sid}?print=1`))}>Print / PDF</Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5 items-start">
        <div className="no-print">
          <InvoiceFormCore form={form} onChange={patchCore} clients={clients} projects={projects} />
        </div>
        <div className="lg:sticky lg:top-6">
          <InvoicePreviewCore
            data={{
              invoiceNumber: invoiceNumber || 'Draft',
              issueDate: form.issue_date,
              dueDate: form.due_date,
              paymentTerms: form.payment_terms,
              currency: form.currency,
              items: form.items,
              discount: form.discount,
              taxRatePercent: form.tax_rate_percent,
              notes: form.notes,
              status: form.status,
            }}
            client={selectedClient}
          />
        </div>
      </div>
    </div>
  )
}
