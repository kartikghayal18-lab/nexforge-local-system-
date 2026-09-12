import React from 'react'
import { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  hint?: string
  icon: LucideIcon
  tone?: 'default' | 'accent' | 'emerald' | 'amber' | 'rose'
}

const toneMap: Record<string, string> = {
  default: 'bg-surface-300 text-ink-300',
  accent: 'bg-accent-500/15 text-accent-400',
  emerald: 'bg-emerald-500/15 text-emerald-400',
  amber: 'bg-amber-500/15 text-amber-400',
  rose: 'bg-rose-500/15 text-rose-400',
}

export function StatCard({ label, value, hint, icon: Icon, tone = 'default' }: StatCardProps) {
  return (
    <div className="rounded-xl border border-surface-400 bg-surface-200 p-4 shadow-soft hover:border-surface-500 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-ink-400 uppercase tracking-wide">{label}</span>
        <div className={`grid place-items-center h-7 w-7 rounded-lg ${toneMap[tone]}`}>
          <Icon size={15} />
        </div>
      </div>
      <div className="text-2xl font-semibold text-ink-100 tabular-nums">{value}</div>
      {hint && <div className="text-xs text-ink-500 mt-1">{hint}</div>}
    </div>
  )
}
