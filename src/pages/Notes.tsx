import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Search, StickyNote, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/common/Button'
import { EmptyState } from '@/components/common/EmptyState'
import { Modal } from '@/components/common/Modal'
import { Input, TextArea, Select } from '@/components/common/Input'
import { useToast } from '@/hooks/useToast'
import { formatDate } from '@/utils/format'
import { coreApi } from '@/data/coreClient'
import type { ProjectNoteWithProject, ProjectFull } from '@/data/coreTypes'

function friendlyError(e: unknown): string {
  console.error(e)
  return e instanceof Error ? e.message : 'Something went wrong. Please try again.'
}

export default function Notes() {
  const { show } = useToast()
  const [params] = useSearchParams()
  const [query, setQuery] = useState('')
  const [showNew, setShowNew] = useState(params.get('new') === '1')
  const [form, setForm] = useState({ projectId: '', title: '', body: '' })

  const [notes, setNotes] = useState<ProjectNoteWithProject[]>([])
  const [projects, setProjects] = useState<ProjectFull[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      const [n, p] = await Promise.all([coreApi.notesListAll(), coreApi.projectsList()])
      setNotes(n)
      setProjects(p)
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return notes.filter(
      (n) => !q || n.title.toLowerCase().includes(q) || (n.content ?? '').toLowerCase().includes(q) || n.project_name.toLowerCase().includes(q)
    )
  }, [notes, query])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.projectId) return
    try {
      await coreApi.projectNotesCreate({ project_id: form.projectId, title: form.title.trim(), content: form.body.trim() || null })
      show('Note added')
      setShowNew(false)
      setForm({ projectId: '', title: '', body: '' })
      reload()
    } catch (e) {
      show(friendlyError(e), 'error')
    }
  }

  async function remove(id: string) {
    try {
      await coreApi.projectNotesDelete(id)
      show('Note deleted')
      reload()
    } catch (e) {
      show(friendlyError(e), 'error')
    }
  }

  return (
    <div>
      <PageHeader
        title="Notes"
        subtitle="Quick thoughts, reminders and project context."
        actions={<Button icon={<Plus size={15} />} onClick={() => setShowNew(true)}>New Note</Button>}
      />

      {error && (
        <div className="mb-4 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-400">
          {error}
        </div>
      )}

      <div className="relative max-w-xs mb-5">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search notes…"
          className="w-full rounded-lg border border-surface-500 bg-surface-300 pl-8 pr-3 py-2 text-sm text-ink-100 placeholder:text-ink-500 outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/40"
        />
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-32 rounded-xl border border-surface-400 bg-surface-200 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={StickyNote} title="No notes found" description="Capture your first note to keep context close." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filtered.map((n) => (
            <div key={n.id} className="rounded-xl border border-surface-400 bg-surface-200 p-4 shadow-soft group">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-sm font-medium text-ink-100">{n.title}</h3>
                  <p className="text-[11px] text-ink-500">{n.project_name}</p>
                </div>
                <button onClick={() => remove(n.id)} className="text-ink-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 size={13} />
                </button>
              </div>
              <p className="text-xs text-ink-400 leading-relaxed whitespace-pre-line line-clamp-4">{n.content}</p>
              <div className="text-[11px] text-ink-600 mt-3">Updated {formatDate(n.updated_at)}</div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showNew} onClose={() => setShowNew(false)} title="New Note">
        <form onSubmit={create} className="space-y-3">
          <Select label="Project" required value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
            <option value="">Select a project…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
          {projects.length === 0 && (
            <p className="text-xs text-amber-400">You need a project before you can add a note. Create one first.</p>
          )}
          <Input label="Title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <TextArea label="Note" rows={5} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={() => setShowNew(false)} className="rounded-lg border border-surface-500 bg-surface-300 px-3.5 py-2 text-sm text-ink-100 hover:bg-surface-400 transition-colors">
              Cancel
            </button>
            <Button type="submit" disabled={!form.projectId}>Add Note</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
