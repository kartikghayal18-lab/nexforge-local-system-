import React from 'react'
import { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-surface-500 bg-surface-200/50 px-6 py-14 text-center">
      <div className="grid place-items-center h-11 w-11 rounded-xl bg-surface-300 text-ink-400 mb-3">
        <Icon size={20} />
      </div>
      <h3 className="text-sm font-medium text-ink-100">{title}</h3>
      {description && <p className="text-xs text-ink-500 mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
