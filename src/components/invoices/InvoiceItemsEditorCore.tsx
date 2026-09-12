import React from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { formatINR } from '@/utils/format'
import type { InvoiceItemInput } from '@/data/coreTypes'

interface Props {
  items: InvoiceItemInput[]
  onChange: (items: InvoiceItemInput[]) => void
}

export function InvoiceItemsEditorCore({ items, onChange }: Props) {
  function update(index: number, patch: Partial<InvoiceItemInput>) {
    onChange(items.map((it, i) => (i === index ? { ...it, ...patch } : it)))
  }
  function addItem() {
    onChange([...items, { description: '', quantity: 1, rate: 0 }])
  }
  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index))
  }

  return (
    <div>
      <div className="rounded-lg border border-surface-500 overflow-hidden">
        <div className="grid grid-cols-[1fr_60px_90px_100px_32px] gap-2 bg-surface-300 px-3 py-2 text-[11px] font-medium text-ink-500 uppercase tracking-wide">
          <span>Description</span>
          <span>Qty</span>
          <span>Rate</span>
          <span>Amount</span>
          <span />
        </div>
        <div className="divide-y divide-surface-400">
          {items.map((item, i) => (
            <div key={i} className="grid grid-cols-[1fr_60px_90px_100px_32px] gap-2 px-3 py-2 items-center">
              <input
                value={item.description}
                onChange={(e) => update(i, { description: e.target.value })}
                placeholder="Item description"
                className="bg-transparent text-sm text-ink-100 placeholder:text-ink-600 outline-none border-b border-transparent focus:border-accent-500 py-1"
              />
              <input
                type="number"
                min={0}
                value={item.quantity}
                onChange={(e) => update(i, { quantity: Number(e.target.value) })}
                className="bg-transparent text-sm text-ink-100 outline-none border-b border-transparent focus:border-accent-500 py-1 tabular-nums"
              />
              <input
                type="number"
                min={0}
                value={item.rate}
                onChange={(e) => update(i, { rate: Number(e.target.value) })}
                className="bg-transparent text-sm text-ink-100 outline-none border-b border-transparent focus:border-accent-500 py-1 tabular-nums"
              />
              <span className="text-sm text-ink-300 tabular-nums">{formatINR((item.quantity || 0) * (item.rate || 0), false)}</span>
              <button
                onClick={() => removeItem(i)}
                disabled={items.length <= 1}
                className="text-ink-500 hover:text-rose-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
      <button
        onClick={addItem}
        className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-medium text-accent-400 hover:text-accent-300 transition-colors"
      >
        <Plus size={13} /> Add Item
      </button>
    </div>
  )
}
