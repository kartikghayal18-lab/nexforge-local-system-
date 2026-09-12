import React from 'react'
import { Invoice, GstMode } from '@/types'
import { Input, Select, TextArea } from '@/components/common/Input'
import { InvoiceItemsEditor } from './InvoiceItemsEditor'

interface Props {
  invoice: Invoice
  onChange: (patch: Partial<Invoice>) => void
}

export function InvoiceForm({ invoice, onChange }: Props) {
  function patchFrom(patch: Partial<Invoice['from']>) {
    onChange({ from: { ...invoice.from, ...patch } })
  }
  function patchBillTo(patch: Partial<Invoice['billTo']>) {
    onChange({ billTo: { ...invoice.billTo, ...patch } })
  }
  function patchPayment(patch: Partial<Invoice['payment']>) {
    onChange({ payment: { ...invoice.payment, ...patch } })
  }

  return (
    <div className="space-y-5">
      <Section title="Invoice Details">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Invoice Number" value={invoice.invoiceNumber} onChange={(e) => onChange({ invoiceNumber: e.target.value })} />
          <Input label="Payment Terms" value={invoice.paymentTerms} onChange={(e) => onChange({ paymentTerms: e.target.value })} />
          <Input type="date" label="Issue Date" value={invoice.issueDate} onChange={(e) => onChange({ issueDate: e.target.value })} />
          <Input type="date" label="Due Date" value={invoice.dueDate} onChange={(e) => onChange({ dueDate: e.target.value })} />
        </div>
      </Section>

      <Section title="From">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Business name" value={invoice.from.name} onChange={(e) => patchFrom({ name: e.target.value })} />
          <Input label="GSTIN" value={invoice.from.gstin ?? ''} onChange={(e) => patchFrom({ gstin: e.target.value })} />
          <Input wrapperClassName="col-span-2" label="Address" value={invoice.from.address} onChange={(e) => patchFrom({ address: e.target.value })} />
          <Input label="City" value={invoice.from.city} onChange={(e) => patchFrom({ city: e.target.value })} />
          <Input label="State" value={invoice.from.state} onChange={(e) => patchFrom({ state: e.target.value })} />
          <Input label="PIN" value={invoice.from.pin} onChange={(e) => patchFrom({ pin: e.target.value })} />
          <Input label="Country" value={invoice.from.country ?? ''} onChange={(e) => patchFrom({ country: e.target.value })} />
          <Input label="Phone" value={invoice.from.phone} onChange={(e) => patchFrom({ phone: e.target.value })} />
          <Input label="Email" value={invoice.from.email} onChange={(e) => patchFrom({ email: e.target.value })} />
          <Input label="Website" value={invoice.from.website ?? ''} onChange={(e) => patchFrom({ website: e.target.value })} />
        </div>
      </Section>

      <Section title="Bill To">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Client / Company name" value={invoice.billTo.name} onChange={(e) => patchBillTo({ name: e.target.value })} />
          <Input label="Contact person" value={invoice.billTo.contactPerson ?? ''} onChange={(e) => patchBillTo({ contactPerson: e.target.value })} />
          <Input wrapperClassName="col-span-2" label="Address" value={invoice.billTo.address} onChange={(e) => patchBillTo({ address: e.target.value })} />
          <Input label="City" value={invoice.billTo.city} onChange={(e) => patchBillTo({ city: e.target.value })} />
          <Input label="State" value={invoice.billTo.state} onChange={(e) => patchBillTo({ state: e.target.value })} />
          <Input label="PIN" value={invoice.billTo.pin} onChange={(e) => patchBillTo({ pin: e.target.value })} />
          <Input label="GSTIN" value={invoice.billTo.gstin ?? ''} onChange={(e) => patchBillTo({ gstin: e.target.value })} />
          <Input label="Email" value={invoice.billTo.email} onChange={(e) => patchBillTo({ email: e.target.value })} />
          <Input label="Phone" value={invoice.billTo.phone} onChange={(e) => patchBillTo({ phone: e.target.value })} />
        </div>
      </Section>

      <Section title="Items">
        <InvoiceItemsEditor items={invoice.items} onChange={(items) => onChange({ items })} />
      </Section>

      <Section title="Discount, Tax & Charges">
        <div className="grid grid-cols-2 gap-3">
          <Select label="Discount Type" value={invoice.discountType} onChange={(e) => onChange({ discountType: e.target.value as any })}>
            <option value="percentage">Percentage (%)</option>
            <option value="fixed">Fixed Amount (₹)</option>
          </Select>
          <Input type="number" min={0} label="Discount Value" value={invoice.discountValue} onChange={(e) => onChange({ discountValue: Number(e.target.value) })} />
          <Select label="GST Mode" value={invoice.gstMode} onChange={(e) => onChange({ gstMode: e.target.value as GstMode })}>
            <option value="CGST_SGST">CGST + SGST</option>
            <option value="IGST">IGST</option>
          </Select>
          <Input type="number" min={0} label="GST %" value={invoice.gstPercentage} onChange={(e) => onChange({ gstPercentage: Number(e.target.value) })} />
          <Input label="Additional Charge Label" value={invoice.additionalChargeLabel} onChange={(e) => onChange({ additionalChargeLabel: e.target.value })} />
          <Input type="number" min={0} label="Additional Charge (₹)" value={invoice.additionalCharge} onChange={(e) => onChange({ additionalCharge: Number(e.target.value) })} />
        </div>
      </Section>

      <Section title="Payment Details">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Bank Name" value={invoice.payment.bankName} onChange={(e) => patchPayment({ bankName: e.target.value })} />
          <Input label="Account Name" value={invoice.payment.accountName} onChange={(e) => patchPayment({ accountName: e.target.value })} />
          <Input label="Account Number" value={invoice.payment.accountNumber} onChange={(e) => patchPayment({ accountNumber: e.target.value })} />
          <Input label="IFSC Code" value={invoice.payment.ifsc} onChange={(e) => patchPayment({ ifsc: e.target.value })} />
          <Input wrapperClassName="col-span-2" label="UPI ID" value={invoice.payment.upi} onChange={(e) => patchPayment({ upi: e.target.value })} />
        </div>
      </Section>

      <Section title="Notes & Terms">
        <TextArea label="Notes (one per line)" rows={3} value={invoice.notes} onChange={(e) => onChange({ notes: e.target.value })} />
        <TextArea label="Terms & Conditions" rows={2} value={invoice.terms} onChange={(e) => onChange({ terms: e.target.value })} className="mt-3" />
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
