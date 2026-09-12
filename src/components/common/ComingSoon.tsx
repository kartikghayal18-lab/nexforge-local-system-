import React from 'react'
import { Sparkles } from 'lucide-react'

export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-surface-400 bg-surface-200 px-6 py-16 text-center">
      <div className="grid place-items-center h-12 w-12 rounded-xl bg-accent-500/15 text-accent-400 mb-4">
        <Sparkles size={22} />
      </div>
      <h3 className="text-base font-semibold text-ink-100">{title}</h3>
      <p className="text-sm text-ink-500 mt-1.5 max-w-sm">{description}</p>
      <span className="mt-4 inline-flex items-center rounded-full border border-accent-500/25 bg-accent-500/10 px-3 py-1 text-xs font-medium text-accent-400">
        Coming in next phase
      </span>
    </div>
  )
}
