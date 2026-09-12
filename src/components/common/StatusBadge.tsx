import React from 'react'

type Status = string

const styles: Record<string, string> = {
  Paid: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  Sent: 'bg-accent-500/15 text-accent-400 border-accent-500/25',
  Draft: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  Overdue: 'bg-rose-500/15 text-rose-400 border-rose-500/25',
  Active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  Planning: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  Completed: 'bg-accent-500/15 text-accent-400 border-accent-500/25',
  Archived: 'bg-ink-600/20 text-ink-400 border-surface-500',
}

export function StatusBadge({ status }: { status: Status }) {
  const cls = styles[status] ?? 'bg-surface-400 text-ink-300 border-surface-500'
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {status}
    </span>
  )
}
