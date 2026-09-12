import React, { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Search, StickyNote, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/common/Button'
import { EmptyState } from '@/components/common/EmptyState'
import { Modal } from '@/components/common/Modal'
import { Input, TextArea } from '@/components/common/Input'
import { useNotes } from '@/hooks/useStore'
import { useToast } from '@/hooks/useToast'
import { formatDate, todayISO } from '@/utils/format'
import { uid } from '@/utils/storage'

export default function Notes() {
  const [notes, setNotes] = useNotes()
  const { show } = useToast()
  const [params] = useSearchParams()
  const [query, setQuery] = useState('')
  const [showNew, setShowNew] = useState(params.get('new') === '1')
  const [form, setForm] = useState({ title: '', body: '' })

  const filtered = notes.filter(
    (n) => !query.trim() || n.title.toLowerCase().includes(query.toLowerCase()) || n.body.toLowerCase().includes(query.toLowerCase())
  )

  function create(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    setNotes([{ id: uid('note'), title: form.title, body: form.body, updatedAt: todayISO() }, ...notes])
    show('Note added')
    setShowNew(false)
    setForm({ title: '', body: '' })
  }

  function remove(id: string) {
    setNotes(notes.filter((n) => n.id !== id))
    show('Note deleted')
  }

  return (
    <div>
      <PageHeader
        title="Notes"
        subtitle="Quick thoughts, reminders and project context."
        actions={<Button icon={<Plus size={15} />} onClick={() => setShowNew(true)}>New Note</Button>}
      />

      <div className="relative max-w-xs mb-5">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search notes…"
          className="w-full rounded-lg border border-surface-500 bg-surface-300 pl-8 pr-3 py-2 text-sm text-ink-100 placeholder:text-ink-500 outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/40"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={StickyNote} title="No notes found" description="Capture your first note to keep context close." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filtered.map((n) => (
            <div key={n.id} className="rounded-xl border border-surface-400 bg-surface-200 p-4 shadow-soft group">
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-sm font-medium text-ink-100">{n.title}</h3>
                <button onClick={() => remove(n.id)} className="text-ink-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 size={13} />
                </button>
              </div>
              <p className="text-xs text-ink-400 leading-relaxed whitespace-pre-line line-clamp-4">{n.body}</p>
              <div className="text-[11px] text-ink-600 mt-3">Updated {formatDate(n.updatedAt)}</div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showNew} onClose={() => setShowNew(false)} title="New Note">
        <form onSubmit={create} className="space-y-3">
          <Input label="Title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <TextArea label="Note" rows={5} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={() => setShowNew(false)} className="rounded-lg border border-surface-500 bg-surface-300 px-3.5 py-2 text-sm text-ink-100 hover:bg-surface-400 transition-colors">
              Cancel
            </button>
            <Button type="submit">Add Note</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
