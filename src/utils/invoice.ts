import { Invoice, InvoiceItem } from '@/types'

export interface InvoiceTotals {
  subtotal: number
  discount: number
  taxable: number
  cgst: number
  sgst: number
  igst: number
  gstTotal: number
  additionalCharge: number
  grandTotal: number
}

export function computeItemAmount(item: InvoiceItem): number {
  return (item.quantity || 0) * (item.rate || 0)
}

export function computeInvoiceTotals(inv: Pick<Invoice, 'items' | 'discountType' | 'discountValue' | 'gstMode' | 'gstPercentage' | 'additionalCharge'>): InvoiceTotals {
  const subtotal = inv.items.reduce((sum, item) => sum + computeItemAmount(item), 0)
  const discount = inv.discountType === 'percentage' ? (subtotal * (inv.discountValue || 0)) / 100 : inv.discountValue || 0
  const taxable = Math.max(subtotal - discount, 0)
  const pct = inv.gstPercentage || 0

  let cgst = 0
  let sgst = 0
  let igst = 0
  if (inv.gstMode === 'IGST') {
    igst = (taxable * pct) / 100
  } else {
    cgst = (taxable * pct) / 100
    sgst = (taxable * pct) / 100
  }
  const gstTotal = cgst + sgst + igst
  const additionalCharge = inv.additionalCharge || 0
  const grandTotal = taxable + gstTotal + additionalCharge

  return { subtotal, discount, taxable, cgst, sgst, igst, gstTotal, additionalCharge, grandTotal }
}
