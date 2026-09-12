import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { StatusBadge } from '@/components/common/StatusBadge'
import { formatDate } from '@/utils/format'

interface ProjectCardProps {
  id: string
  name: string
  client: string
  status: string
  tags: string[]
  updatedAt: string
  hasWebsite?: boolean
}

export function ProjectCard({ id, name, client, status, tags, updatedAt, hasWebsite }: ProjectCardProps) {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate(`/projects/${id}`)}
      className="text-left rounded-xl border border-surface-400 bg-surface-200 p-4 shadow-soft hover:border-accent-500/40 hover:-translate-y-0.5 transition-all duration-150"
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-sm font-semibold text-ink-100">{name}</h3>
        <StatusBadge status={status} />
      </div>
      <p className="text-xs text-ink-500 mb-3">{client}</p>
      <div className="flex items-center gap-1.5 flex-wrap mb-3">
        {tags.map((t) => (
          <span key={t} className="text-[10px] font-medium text-ink-400 bg-surface-300 border border-surface-500 rounded px-1.5 py-0.5">
            {t}
          </span>
        ))}
      </div>
      <div className="flex items-center justify-between text-xs text-ink-500 pt-3 border-t border-surface-400">
        <span>Updated {formatDate(updatedAt)}</span>
        {hasWebsite && <ExternalLink size={12} className="text-ink-500" />}
      </div>
    </button>
  )
}
