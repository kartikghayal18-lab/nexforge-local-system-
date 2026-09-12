import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, Pencil, Copy, Printer, Trash2 } from 'lucide-react'
import { Invoice } from '@/types'
import { StatusBadge } from '@/components/common/StatusBadge'
import { computeInvoiceTotals } from '@/utils/invoice'
import { formatINR, formatDate } from '@/utils/format'

interface Props {
  invoices: Invoice[]
  onDuplicate: (inv: Invoice) => void
  onDelete: (inv: Invoice) => void
}

export function InvoiceTable({ invoices, onDuplicate, onDelete }: Props) {
  const navigate = useNavigate()

  return (
    <div className="rounded-xl border border-surface-400 bg-surface-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] font-medium text-ink-500 uppercase tracking-wide bg-surface-300 border-b border-surface-400">
              <th className="px-4 py-2.5">Invoice #</th>
              <th className="px-4 py-2.5">Client</th>
              <th className="px-4 py-2.5">Issue Date</th>
              <th className="px-4 py-2.5">Due Date</th>
              <th className="px-4 py-2.5 text-right">Amount</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-400">
            {invoices.map((inv) => {
              const total = computeInvoiceTotals(inv).grandTotal
              return (
                <tr key={inv.id} className="hover:bg-surface-300/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-ink-100">{inv.invoiceNumber}</td>
                  <td className="px-4 py-3 text-ink-300">{inv.billTo.name}</td>
                  <td className="px-4 py-3 text-ink-400">{formatDate(inv.issueDate)}</td>
                  <td className="px-4 py-3 text-ink-400">{formatDate(inv.dueDate)}</td>
                  <td className="px-4 py-3 text-right text-ink-100 tabular-nums">{formatINR(total)}</td>
                  <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <IconBtn title="View" onClick={() => navigate(`/invoices/${inv.id}`)}><Eye size={14} /></IconBtn>
                      <IconBtn title="Edit" onClick={() => navigate(`/invoices/${inv.id}/edit`)}><Pencil size={14} /></IconBtn>
                      <IconBtn title="Duplicate" onClick={() => onDuplicate(inv)}><Copy size={14} /></IconBtn>
                      <IconBtn title="Print" onClick={() => navigate(`/invoices/${inv.id}?print=1`)}><Printer size={14} /></IconBtn>
                      <IconBtn title="Delete" danger onClick={() => onDelete(inv)}><Trash2 size={14} /></IconBtn>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
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
