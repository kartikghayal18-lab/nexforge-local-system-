import React from 'react'
import { Boxes } from 'lucide-react'
import { Invoice } from '@/types'
import { computeInvoiceTotals, computeItemAmount } from '@/utils/invoice'
import { formatINR, formatDate } from '@/utils/format'
import { NEXFORGE_PROFILE } from '@/data/seed'

export function InvoicePreview({ invoice }: { invoice: Invoice }) {
  const t = computeInvoiceTotals(invoice)

  return (
    <div id="invoice-print-area" className="bg-white text-[#1c2130] rounded-xl overflow-hidden shadow-panel print:shadow-none print:rounded-none">
      <div className="p-8 sm:p-10">
        {/* Header */}
        <div className="flex items-start justify-between pb-6 border-b-2 border-[#eef0fe]">
          <div>
            <div className="flex items-center gap-2">
              <div className="grid place-items-center h-8 w-8 rounded-lg bg-[#5b6bf5] text-white">
                <Boxes size={16} />
              </div>
              <div>
                <div className="text-lg font-extrabold tracking-tight leading-none">NEXFORGE</div>
                <div className="text-[10px] font-semibold tracking-[0.2em] text-[#5b6bf5] leading-none mt-0.5">STUDIOS</div>
              </div>
            </div>
            <div className="text-[10px] font-medium tracking-[0.15em] text-[#8b93a7] mt-2">
              {NEXFORGE_PROFILE.tagline}
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-extrabold tracking-tight text-[#1c2130]">INVOICE</div>
            <div className="text-xs text-[#6b7385] mt-1"># {invoice.invoiceNumber}</div>
          </div>
        </div>

        {/* Meta + From/BillTo */}
        <div className="grid grid-cols-2 gap-6 mt-6">
          <div>
            <div className="text-[10px] font-bold tracking-widest text-[#8b93a7] mb-1.5">BILL TO</div>
            <div className="text-sm font-semibold text-[#1c2130]">{invoice.billTo.name}</div>
            {invoice.billTo.contactPerson && <div className="text-xs text-[#6b7385] mt-0.5">Attn: {invoice.billTo.contactPerson}</div>}
            <div className="text-xs text-[#6b7385] mt-1 leading-relaxed">
              {invoice.billTo.address && <div>{invoice.billTo.address}</div>}
              <div>
                {[invoice.billTo.city, invoice.billTo.state, invoice.billTo.pin].filter(Boolean).join(', ')}
              </div>
              {invoice.billTo.country && <div>{invoice.billTo.country}</div>}
              {invoice.billTo.gstin && <div className="mt-1">GSTIN: {invoice.billTo.gstin}</div>}
            </div>
          </div>
          <div className="text-right">
            <div className="inline-block text-left rounded-lg bg-[#f5f6f8] border border-[#eef0fe] px-3.5 py-2.5 min-w-[200px]">
              <MetaRow label="Invoice Date" value={formatDate(invoice.issueDate)} />
              <MetaRow label="Due Date" value={formatDate(invoice.dueDate)} />
              <MetaRow label="Payment Terms" value={invoice.paymentTerms} last />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mt-4">
          <div>
            <div className="text-[10px] font-bold tracking-widest text-[#8b93a7] mb-1.5">FROM</div>
            <div className="text-sm font-semibold text-[#1c2130]">{invoice.from.name}</div>
            <div className="text-xs text-[#6b7385] mt-1 leading-relaxed">
              <div>{invoice.from.address}</div>
              <div>{[invoice.from.city, invoice.from.state, invoice.from.pin].filter(Boolean).join(', ')}</div>
              <div>{invoice.from.country}</div>
              {invoice.from.gstin && <div className="mt-1">GSTIN: {invoice.from.gstin}</div>}
              <div className="mt-1">{invoice.from.email} · {invoice.from.phone}</div>
            </div>
          </div>
        </div>

        {/* Items table */}
        <div className="mt-6 rounded-lg overflow-hidden border border-[#eef0fe]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#f5f6f8] text-[10px] font-bold tracking-widest text-[#8b93a7]">
                <th className="text-left px-3 py-2 w-8">#</th>
                <th className="text-left px-3 py-2">Description</th>
                <th className="text-right px-3 py-2 w-16">Qty</th>
                <th className="text-right px-3 py-2 w-24">Rate (INR)</th>
                <th className="text-right px-3 py-2 w-28">Amount (INR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eef0fe]">
              {invoice.items.map((item, i) => (
                <tr key={item.id}>
                  <td className="px-3 py-2.5 text-[#8b93a7]">{i + 1}</td>
                  <td className="px-3 py-2.5 text-[#1c2130]">{item.description || 'Untitled item'}</td>
                  <td className="px-3 py-2.5 text-right text-[#4d5566] tabular-nums">{item.quantity}</td>
                  <td className="px-3 py-2.5 text-right text-[#4d5566] tabular-nums">{formatINR(item.rate, false)}</td>
                  <td className="px-3 py-2.5 text-right text-[#1c2130] font-medium tabular-nums">{formatINR(computeItemAmount(item), false)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end mt-4">
          <div className="w-full max-w-[280px] space-y-1.5 text-sm">
            <TotalRow label="Subtotal" value={formatINR(t.subtotal)} />
            {t.discount > 0 && <TotalRow label="Discount" value={`- ${formatINR(t.discount)}`} />}
            {invoice.gstMode === 'CGST_SGST' ? (
              <>
                <TotalRow label={`CGST (${invoice.gstPercentage}%)`} value={formatINR(t.cgst)} />
                <TotalRow label={`SGST (${invoice.gstPercentage}%)`} value={formatINR(t.sgst)} />
              </>
            ) : (
              <TotalRow label={`IGST (${invoice.gstPercentage}%)`} value={formatINR(t.igst)} />
            )}
            {t.additionalCharge > 0 && (
              <TotalRow label={invoice.additionalChargeLabel || 'Additional Charge'} value={formatINR(t.additionalCharge)} />
            )}
            <div className="flex items-center justify-between rounded-lg bg-[#5b6bf5]/10 border border-[#5b6bf5]/20 px-3.5 py-2.5 mt-1.5">
              <span className="text-sm font-bold text-[#1c2130]">Grand Total</span>
              <span className="text-base font-extrabold text-[#4753d6] tabular-nums">{formatINR(t.grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* Payment + Notes */}
        <div className="grid sm:grid-cols-2 gap-6 mt-6 pt-6 border-t border-[#eef0fe]">
          <div>
            <div className="text-[10px] font-bold tracking-widest text-[#8b93a7] mb-1.5">PAYMENT DETAILS</div>
            <div className="rounded-lg bg-[#f5f6f8] border border-[#eef0fe] px-3.5 py-3 text-xs text-[#4d5566] space-y-1">
              <PayRow label="Bank Name" value={invoice.payment.bankName} />
              <PayRow label="Account Name" value={invoice.payment.accountName} />
              <PayRow label="Account No." value={invoice.payment.accountNumber} />
              <PayRow label="IFSC Code" value={invoice.payment.ifsc} />
              <PayRow label="UPI" value={invoice.payment.upi} />
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold tracking-widest text-[#8b93a7] mb-1.5">NOTES</div>
            <ul className="text-xs text-[#4d5566] space-y-1 list-disc list-inside leading-relaxed">
              {invoice.notes.split('\n').filter(Boolean).map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
            {invoice.terms && (
              <>
                <div className="text-[10px] font-bold tracking-widest text-[#8b93a7] mt-3 mb-1">TERMS & CONDITIONS</div>
                <p className="text-[11px] text-[#8b93a7] leading-relaxed">{invoice.terms}</p>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-end justify-between mt-10 pt-6 border-t border-[#eef0fe]">
          <div className="text-xs text-[#8b93a7]">
            {invoice.from.website} · {invoice.from.email} · {invoice.from.phone}
          </div>
          <div className="text-right">
            <div className="h-10 w-32 border-b border-[#c4c9d4] mb-1" />
            <div className="text-[11px] font-semibold text-[#1c2130]">Authorized Signatory</div>
            <div className="text-[10px] text-[#8b93a7]">Nexforge Studios</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MetaRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-6 py-0.5 ${!last ? '' : ''}`}>
      <span className="text-[11px] text-[#8b93a7]">{label}</span>
      <span className="text-xs font-medium text-[#1c2130]">{value}</span>
    </div>
  )
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[#6b7385]">{label}</span>
      <span className="text-[#1c2130] tabular-nums">{value}</span>
    </div>
  )
}

function PayRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[#8b93a7]">{label}</span>
      <span className="text-[#1c2130] font-medium">{value}</span>
    </div>
  )
}
