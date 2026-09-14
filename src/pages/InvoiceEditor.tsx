import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, Send, CheckCircle2, Printer } from 'lucide-react'
import { Button } from '@/components/common/Button'
import { InvoiceFormCore, CoreInvoiceFormState } from '@/components/invoices/InvoiceFormCore'
import { InvoicePreviewCore, CorePreviewSettings } from '@/components/invoices/InvoicePreviewCore'
import { useToast } from '@/hooks/useToast'
import { coreApi } from '@/data/coreClient'
import type { Client, ProjectFull, NewInvoice, UpdateInvoice } from '@/data/coreTypes'
import { todayISO } from '@/utils/format'

function friendlyError(e: unknown): string {
  console.error(e)
  return e instanceof Error ? e.message : 'Something went wrong. Please try again.'
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
    tax_rate_percent: 0,
    notes: '',
    payment_terms: 'Net 14 Days',
    items: [{ description: '', quantity: 1, rate: 0 }],
  }
}

export default function InvoiceEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { show } = useToast()

  const [clients, setClients] = useState<Client[]>([])
  const [projects, setProjects] = useState<ProjectFull[]>([])
  const [form, setForm] = useState<CoreInvoiceFormState>(blankCoreForm())
  const [invoiceNumber, setInvoiceNumber] = useState<string>('')
  const [bizSettings, setBizSettings] = useState<CorePreviewSettings>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        const [c, p] = await Promise.all([coreApi.clientsList(), coreApi.projectsList()])
        setClients(c)
        setProjects(p)
        // Always refetch business settings fresh on mount, so an editor
        // opened after a Settings save shows the current saved values —
        // never seed.ts placeholders and never a stale cross-navigation cache.
        try {
          setBizSettings(await coreApi.settingsGetAll())
        } catch {
          // Non-fatal — preview falls back to blanks (fields are omitted).
        }
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
        } else {
          // New invoice: pull tax/currency/terms defaults from the real
          // business settings (never hardcoded) — see Settings.tsx "biz".
          try {
            const settings = await coreApi.settingsGetAll()
            setForm((prev) => ({
              ...prev,
              currency: settings.currency || prev.currency,
              tax_rate_percent: settings.default_tax_rate ? Number(settings.default_tax_rate) || 0 : prev.tax_rate_percent,
              payment_terms: settings.payment_terms || prev.payment_terms,
              notes: settings.footer_text || prev.notes,
            }))
          } catch {
            // Non-fatal — form keeps its blank defaults.
          }
        }
      } catch (e) {
        show(friendlyError(e), 'error')
      } finally {
        setLoading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

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
            settings={bizSettings}
          />
        </div>
      </div>
    </div>
  )
}
