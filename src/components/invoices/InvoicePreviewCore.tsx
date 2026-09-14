import React from 'react'
import { Boxes } from 'lucide-react'
import { formatINR, formatDate } from '@/utils/format'
import type { InvoiceItemInput, Client } from '@/data/coreTypes'

// Business identity shown on the invoice — always the real, saved
// business_settings (server/src/routes/settings.js), never a hardcoded
// placeholder. Every field is optional: an empty/unset setting means the
// corresponding line is simply omitted from the invoice, not replaced by
// a fallback string.
export interface CorePreviewSettings {
  business_name?: string | null
  business_address?: string | null
  business_gstin?: string | null
  business_email?: string | null
  business_phone?: string | null
  business_website?: string | null
  logo_url?: string | null
}

export interface CorePreviewData {
  invoiceNumber: string
  issueDate: string
  dueDate: string
  paymentTerms: string | null
  currency: string
  items: InvoiceItemInput[]
  discount: number
  taxRatePercent: number
  notes: string | null
  status: string
}

function computeTotals(items: InvoiceItemInput[], discount: number, taxRatePercent: number) {
  const subtotal = items.reduce((s, it) => s + (it.quantity || 0) * (it.rate || 0), 0)
  const taxable = Math.max(subtotal - (discount || 0), 0)
  const tax = (taxable * (taxRatePercent || 0)) / 100
  const total = taxable + tax
  return { subtotal, taxable, tax, total }
}

export function InvoicePreviewCore({ data, client, settings }: { data: CorePreviewData; client: Client | null; settings?: CorePreviewSettings | null }) {
  const biz = settings || {}
  const t = computeTotals(data.items, data.discount, data.taxRatePercent)

  return (
    <div id="invoice-print-area" className="bg-white text-[#1c2130] rounded-xl overflow-hidden shadow-panel print:shadow-none print:rounded-none">
      <div className="p-8 sm:p-10">
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
            {biz.logo_url && (
              <img src={biz.logo_url} alt="" className="h-8 mt-2 object-contain" />
            )}
          </div>
          <div className="text-right">
            <div className="text-2xl font-extrabold tracking-tight text-[#1c2130]">INVOICE</div>
            <div className="text-xs text-[#6b7385] mt-1"># {data.invoiceNumber || 'Draft'}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mt-6">
          <div>
            <div className="text-[10px] font-bold tracking-widest text-[#8b93a7] mb-1.5">BILL TO</div>
            <div className="text-sm font-semibold text-[#1c2130]">{client?.company || client?.name || 'No client selected'}</div>
            <div className="text-xs text-[#6b7385] mt-1 leading-relaxed">
              {client?.address && <div>{client.address}</div>}
              {client?.gstin && <div className="mt-1">GSTIN: {client.gstin}</div>}
              {(client?.email || client?.phone) && <div className="mt-1">{[client?.email, client?.phone].filter(Boolean).join(' · ')}</div>}
            </div>
          </div>
          <div className="text-right">
            <div className="inline-block text-left rounded-lg bg-[#f5f6f8] border border-[#eef0fe] px-3.5 py-2.5 min-w-[200px]">
              <MetaRow label="Invoice Date" value={formatDate(data.issueDate)} />
              <MetaRow label="Due Date" value={formatDate(data.dueDate)} />
              <MetaRow label="Payment Terms" value={data.paymentTerms || '—'} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mt-4">
          <div>
            <div className="text-[10px] font-bold tracking-widest text-[#8b93a7] mb-1.5">FROM</div>
            <div className="text-sm font-semibold text-[#1c2130]">{biz.business_name || 'Your Business'}</div>
            <div className="text-xs text-[#6b7385] mt-1 leading-relaxed">
              {biz.business_address && <div>{biz.business_address}</div>}
              {biz.business_gstin && <div className="mt-1">GSTIN: {biz.business_gstin}</div>}
              {(biz.business_email || biz.business_phone) && (
                <div className="mt-1">{[biz.business_email, biz.business_phone].filter(Boolean).join(' · ')}</div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-lg overflow-hidden border border-[#eef0fe]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#f5f6f8] text-[10px] font-bold tracking-widest text-[#8b93a7]">
                <th className="text-left px-3 py-2 w-8">#</th>
                <th className="text-left px-3 py-2">Description</th>
                <th className="text-right px-3 py-2 w-16">Qty</th>
                <th className="text-right px-3 py-2 w-24">Rate</th>
                <th className="text-right px-3 py-2 w-28">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eef0fe]">
              {data.items.map((item, i) => (
                <tr key={i}>
                  <td className="px-3 py-2.5 text-[#8b93a7]">{i + 1}</td>
                  <td className="px-3 py-2.5 text-[#1c2130]">{item.description || 'Untitled item'}</td>
                  <td className="px-3 py-2.5 text-right text-[#4d5566] tabular-nums">{item.quantity}</td>
                  <td className="px-3 py-2.5 text-right text-[#4d5566] tabular-nums">{formatINR(item.rate, false)}</td>
                  <td className="px-3 py-2.5 text-right text-[#1c2130] font-medium tabular-nums">{formatINR((item.quantity || 0) * (item.rate || 0), false)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end mt-4">
          <div className="w-full max-w-[280px] space-y-1.5 text-sm">
            <TotalRow label="Subtotal" value={formatINR(t.subtotal)} />
            {data.discount > 0 && <TotalRow label="Discount" value={`- ${formatINR(data.discount)}`} />}
            <TotalRow label={`Tax (${data.taxRatePercent || 0}%)`} value={formatINR(t.tax)} />
            <div className="flex items-center justify-between rounded-lg bg-[#5b6bf5]/10 border border-[#5b6bf5]/20 px-3.5 py-2.5 mt-1.5">
              <span className="text-sm font-bold text-[#1c2130]">Grand Total</span>
              <span className="text-base font-extrabold text-[#4753d6] tabular-nums">{formatINR(t.total)}</span>
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-6 mt-6 pt-6 border-t border-[#eef0fe]">
          <div>
            <div className="text-[10px] font-bold tracking-widest text-[#8b93a7] mb-1.5">NOTES</div>
            <p className="text-xs text-[#4d5566] leading-relaxed whitespace-pre-line">{data.notes || '—'}</p>
          </div>
        </div>

        <div className="flex items-end justify-between mt-10 pt-6 border-t border-[#eef0fe]">
          <div className="text-xs text-[#8b93a7]">
            {[biz.business_website, biz.business_email, biz.business_phone].filter(Boolean).join(' · ')}
          </div>
          <div className="text-right">
            <div className="h-10 w-32 border-b border-[#c4c9d4] mb-1" />
            <div className="text-[11px] font-semibold text-[#1c2130]">Authorized Signatory</div>
            <div className="text-[10px] text-[#8b93a7]">{biz.business_name || ''}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export { computeTotals as computeCoreTotals }

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-6 py-0.5">
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
