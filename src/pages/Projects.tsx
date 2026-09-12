import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Search, FolderKanban, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/common/Button'
import { EmptyState } from '@/components/common/EmptyState'
import { ProjectCard } from '@/components/projects/ProjectCard'
import { Modal, ConfirmDialog } from '@/components/common/Modal'
import { Input, TextArea } from '@/components/common/Input'
import { useProjects as useLegacyProjects } from '@/hooks/useStore'
import { useToast } from '@/hooks/useToast'
import { ProjectStatus } from '@/types'
import { uid } from '@/utils/storage'
import { todayISO } from '@/utils/format'
import { coreApi, isDesktop } from '@/data/coreClient'
import type { ProjectFull, NewProject } from '@/data/coreTypes'

const filters: ('All' | ProjectStatus)[] = ['All', 'Active', 'Planning', 'Completed', 'Archived']

function friendlyError(e: unknown): string {
  console.error(e)
  return 'Something went wrong. Please try again.'
}

export default function Projects() {
  const desktop = isDesktop()

  // Legacy localStorage-backed store, used only as a browser-mode fallback
  // (demo data) when Desktop Mode / the Rust backend is unavailable.
  const [legacyProjects, setLegacyProjects] = useLegacyProjects()

  const [dbProjects, setDbProjects] = useState<ProjectFull[]>([])
  const [loading, setLoading] = useState(desktop)
  const [error, setError] = useState<string | null>(null)

  const [params, setParams] = useSearchParams()
  const { show } = useToast()
  const [filter, setFilter] = useState<'All' | ProjectStatus>('All')
  const [query, setQuery] = useState(params.get('q') ?? '')
  const [showNew, setShowNew] = useState(params.get('new') === '1')
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  const [form, setForm] = useState({ name: '', client: '', description: '', technology: '' })

  async function reload() {
    if (!desktop) return
    setLoading(true)
    setError(null)
    try {
      const rows = await coreApi.projectsList()
      setDbProjects(rows)
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Unified display shape regardless of source.
  const items = useMemo(() => {
    if (desktop) {
      return dbProjects.map((p) => ({
        id: p.id,
        name: p.name,
        client: p.client || 'Unassigned',
        status: (p.status || 'Planning') as ProjectStatus,
        tags: (p.tech_stack || '').split(',').map((t) => t.trim()).filter(Boolean),
        updatedAt: p.updated_at,
        hasWebsite: !!p.live_url,
      }))
    }
    return legacyProjects.map((p) => ({
      id: p.id,
      name: p.name,
      client: p.client,
      status: p.status,
      tags: p.technology,
      updatedAt: p.updatedAt,
      hasWebsite: !!p.websiteUrl,
    }))
  }, [desktop, dbProjects, legacyProjects])

  const filtered = useMemo(() => {
    return items.filter((p) => {
      const matchesFilter = filter === 'All' || p.status === filter
      const q = query.trim().toLowerCase()
      const matchesQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.client.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
      return matchesFilter && matchesQuery
    })
  }, [items, filter, query])

  function closeModal() {
    setShowNew(false)
    setForm({ name: '', client: '', description: '', technology: '' })
    if (params.get('new')) {
      params.delete('new')
      setParams(params, { replace: true })
    }
  }

  async function createProject(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return

    if (desktop) {
      const input: NewProject = {
        name: form.name.trim(),
        client_id: null,
        client: form.client.trim() || null,
        description: form.description.trim() || null,
        status: 'Planning',
        category: null,
        tech_stack: form.technology.trim() || null,
        framework: null,
        backend: null,
        database_type: null,
        hosting: null,
        repository_url: null,
        live_url: null,
        staging_url: null,
        start_date: null,
        deadline: null,
        budget: null,
        notes: null,
      }
      try {
        await coreApi.projectsCreate(input)
        show('Project created')
        closeModal()
        reload()
      } catch (e) {
        show(friendlyError(e), 'error')
      }
      return
    }

    const now = todayISO()
    setLegacyProjects([
      {
        id: uid('proj'),
        name: form.name.trim(),
        client: form.client.trim() || 'Unassigned',
        description: form.description.trim(),
        technology: form.technology.split(',').map((t) => t.trim()).filter(Boolean),
        status: 'Planning',
        createdAt: now,
        updatedAt: now,
      },
      ...legacyProjects,
    ])
    show('Project created')
    closeModal()
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    if (desktop) {
      try {
        await coreApi.projectsDelete(deleteTarget.id)
        show('Project deleted')
        setDeleteTarget(null)
        reload()
      } catch (e) {
        show(friendlyError(e), 'error')
      }
    } else {
      setLegacyProjects(legacyProjects.filter((p) => p.id !== deleteTarget.id))
      show('Project deleted')
      setDeleteTarget(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Projects"
        subtitle="Manage all Nexforge Studio projects."
        actions={
          <Button icon={<Plus size={15} />} onClick={() => setShowNew(true)}>
            New Project
          </Button>
        }
      />

      {!desktop && (
        <div className="mb-4 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-400">
          Demo data — open this app in Desktop Mode to save projects permanently.
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-400">
          {error}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects…"
            className="w-full rounded-lg border border-surface-500 bg-surface-300 pl-8 pr-3 py-2 text-sm text-ink-100 placeholder:text-ink-500 outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/40"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-surface-500 bg-surface-300 p-1">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filter === f ? 'bg-accent-500 text-white' : 'text-ink-400 hover:text-ink-100'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-32 rounded-xl border border-surface-400 bg-surface-200 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects found"
          description="Try a different filter, or create your first project."
          action={<Button size="sm" icon={<Plus size={14} />} onClick={() => setShowNew(true)}>New Project</Button>}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filtered.map((p) => (
            <div key={p.id} className="relative group">
              <ProjectCard {...p} />
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setDeleteTarget({ id: p.id, name: p.name })
                }}
                className="absolute top-3 right-9 text-ink-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Delete project"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal open={showNew} onClose={closeModal} title="New Project" size="md">
        <form onSubmit={createProject} className="space-y-3">
          <Input label="Project name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Client Portal" />
          <Input label="Client" value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} placeholder="e.g. ABC Tech Solutions" />
          <Input label="Technology (comma separated)" value={form.technology} onChange={(e) => setForm({ ...form, technology: e.target.value })} placeholder="React, Supabase" />
          <TextArea label="Description" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Short description of the project" />
          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={closeModal} className="rounded-lg border border-surface-500 bg-surface-300 px-3.5 py-2 text-sm text-ink-100 hover:bg-surface-400 transition-colors">
              Cancel
            </button>
            <Button type="submit">Create Project</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete project"
        message={`Delete "${deleteTarget?.name}"? This also removes its notes, links and files. This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
