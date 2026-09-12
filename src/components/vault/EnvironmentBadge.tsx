import React from 'react'

const styles: Record<string, string> = {
  Development: 'bg-sky-500/15 text-sky-400 border-sky-500/25',
  Staging: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  Production: 'bg-rose-500/15 text-rose-400 border-rose-500/25',
  Shared: 'bg-violet-500/15 text-violet-400 border-violet-500/25',
}

export function EnvironmentBadge({ environment }: { environment: string | null | undefined }) {
  const env = environment || 'Shared'
  const cls = styles[env] ?? 'bg-surface-400 text-ink-300 border-surface-500'
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {env}
    </span>
  )
}

const categoryColors: Record<string, string> = {
  'API Key': 'text-accent-400',
  'API Secret': 'text-accent-400',
  'Database URL': 'text-amber-400',
  'Database Password': 'text-amber-400',
  Authentication: 'text-violet-400',
  Email: 'text-rose-400',
  Firebase: 'text-orange-400',
  Supabase: 'text-emerald-400',
  Neon: 'text-teal-400',
  'Payment Gateway': 'text-fuchsia-400',
  Hosting: 'text-sky-400',
  GitHub: 'text-ink-200',
  Vercel: 'text-ink-200',
  Token: 'text-lime-400',
  Webhook: 'text-cyan-400',
  Custom: 'text-ink-400',
}

export function CategoryTag({ category }: { category: string }) {
  return (
    <span className={`text-[11px] font-medium ${categoryColors[category] ?? 'text-ink-400'}`}>
      {category}
    </span>
  )
}
