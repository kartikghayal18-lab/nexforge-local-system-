import React from 'react'
import { Invoice } from '@/types'
import { computeInvoiceTotals } from '@/utils/invoice'
import { formatINR } from '@/utils/format'

export function InvoiceTotalsPanel({ invoice }: { invoice: Invoice }) {
  const t = computeInvoiceTotals(invoice)
  return (
    <div className="space-y-1.5 text-sm">
      <Row label="Subtotal" value={formatINR(t.subtotal)} />
      {t.discount > 0 && <Row label="Discount" value={`- ${formatINR(t.discount)}`} muted />}
      {invoice.gstMode === 'CGST_SGST' ? (
        <>
          <Row label={`CGST (${invoice.gstPercentage}%)`} value={formatINR(t.cgst)} />
          <Row label={`SGST (${invoice.gstPercentage}%)`} value={formatINR(t.sgst)} />
        </>
      ) : (
        <Row label={`IGST (${invoice.gstPercentage}%)`} value={formatINR(t.igst)} />
      )}
      {t.additionalCharge > 0 && <Row label={invoice.additionalChargeLabel || 'Additional Charge'} value={formatINR(t.additionalCharge)} />}
      <div className="flex items-center justify-between rounded-lg bg-accent-500/12 border border-accent-500/25 px-3 py-2.5 mt-2">
        <span className="text-sm font-semibold text-ink-100">Grand Total</span>
        <span className="text-base font-bold text-accent-400 tabular-nums">{formatINR(t.grandTotal)}</span>
      </div>
    </div>
  )
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-400">{label}</span>
      <span className={`tabular-nums ${muted ? 'text-rose-400' : 'text-ink-200'}`}>{value}</span>
    </div>
  )
}
