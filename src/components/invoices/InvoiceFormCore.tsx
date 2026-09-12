import React from 'react'
import { Input, Select, TextArea } from '@/components/common/Input'
import { InvoiceItemsEditorCore } from './InvoiceItemsEditorCore'
import type { InvoiceItemInput, Client, ProjectFull } from '@/data/coreTypes'

export interface CoreInvoiceFormState {
  client_id: string | null
  project_id: string | null
  issue_date: string
  due_date: string
  status: string
  currency: string
  discount: number
  tax_rate_percent: number
  notes: string
  payment_terms: string
  items: InvoiceItemInput[]
}

interface Props {
  form: CoreInvoiceFormState
  onChange: (patch: Partial<CoreInvoiceFormState>) => void
  clients: Client[]
  projects: ProjectFull[]
}

export function InvoiceFormCore({ form, onChange, clients, projects }: Props) {
  return (
    <div className="space-y-5">
      <Section title="Invoice Details">
        <div className="grid grid-cols-2 gap-3">
          <Select label="Client" value={form.client_id ?? ''} onChange={(e) => onChange({ client_id: e.target.value || null })}>
            <option value="">Select client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.company || c.name || c.id}</option>
            ))}
          </Select>
          <Select label="Project (optional)" value={form.project_id ?? ''} onChange={(e) => onChange({ project_id: e.target.value || null })}>
            <option value="">No project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
          <Input type="date" label="Issue Date" value={form.issue_date} onChange={(e) => onChange({ issue_date: e.target.value })} />
          <Input type="date" label="Due Date" value={form.due_date} onChange={(e) => onChange({ due_date: e.target.value })} />
          <Input label="Payment Terms" value={form.payment_terms} onChange={(e) => onChange({ payment_terms: e.target.value })} placeholder="e.g. Net 14 Days" />
          <Select label="Status" value={form.status} onChange={(e) => onChange({ status: e.target.value })}>
            {['Draft', 'Sent', 'Paid', 'Partially Paid', 'Overdue', 'Cancelled'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </div>
      </Section>

      <Section title="Items">
        <InvoiceItemsEditorCore items={form.items} onChange={(items) => onChange({ items })} />
      </Section>

      <Section title="Discount &amp; Tax">
        <div className="grid grid-cols-2 gap-3">
          <Input type="number" min={0} label="Discount (₹)" value={form.discount} onChange={(e) => onChange({ discount: Number(e.target.value) })} />
          <Input type="number" min={0} label="Tax %" value={form.tax_rate_percent} onChange={(e) => onChange({ tax_rate_percent: Number(e.target.value) })} />
        </div>
      </Section>

      <Section title="Notes">
        <TextArea label="Notes" rows={3} value={form.notes} onChange={(e) => onChange({ notes: e.target.value })} />
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-surface-400 bg-surface-200 p-4">
      <h3 className="text-xs font-semibold text-ink-300 uppercase tracking-wide mb-3">{title}</h3>
      {children}
    </section>
  )
}
