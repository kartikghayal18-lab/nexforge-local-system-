import React, { useEffect, useState } from 'react'
import { Download, FileText, Plus, Trash2, Upload } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { Select } from '@/components/common/Input'
import { ConfirmDialog } from '@/components/common/Modal'
import { useToast } from '@/hooks/useToast'
import { formatDate } from '@/utils/format'
import { coreApi } from '@/data/coreClient'
import { useProjectPicker } from '@/components/vault/useProjectPicker'
import type { ProjectFile } from '@/data/coreTypes'

function friendlyError(e: unknown): string {
  console.error(e)
  return e instanceof Error ? e.message : 'Something went wrong. Please try again.'
}

function formatBytes(n: number): string {
  if (!n) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let v = n
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`
}

export default function Files() {
  const { show } = useToast()
  const { needsPicker, loading: projectsLoading, projects, selected, setSelected, resolvedProjectId, noProjects } = useProjectPicker(null)

  const [files, setFiles] = useState<ProjectFile[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  async function reload(projectId: string) {
    setLoading(true)
    setError(null)
    try {
      setFiles(await coreApi.projectFilesList(projectId))
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (resolvedProjectId) reload(resolvedProjectId)
    else setFiles([])
  }, [resolvedProjectId])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !resolvedProjectId) return
    if (file.size > 20 * 1024 * 1024) {
      show('File is too large (20MB max).', 'error')
      return
    }
    setUploading(true)
    try {
      await coreApi.projectFilesUpload(resolvedProjectId, file)
      show('File uploaded')
      reload(resolvedProjectId)
    } catch (e) {
      show(friendlyError(e), 'error')
    } finally {
      setUploading(false)
    }
  }

  async function confirmDelete() {
    if (!deleteId || !resolvedProjectId) return
    try {
      await coreApi.projectFilesDelete(deleteId)
      show('File deleted')
      setDeleteId(null)
      reload(resolvedProjectId)
    } catch (e) {
      show(friendlyError(e), 'error')
    }
  }

  return (
    <div>
      <PageHeader title="Files" subtitle="Project documents, contracts, assets and requirements." />

      {error && (
        <div className="mb-4 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-400">
          {error}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <div className="max-w-xs w-full">
          <Select
            label="Project"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={projectsLoading}
          >
            <option value="">Select a project…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        </div>
        {resolvedProjectId && (
          <label className="inline-flex items-center gap-1.5 rounded-lg bg-accent-500 text-white text-xs font-medium px-3 py-2 cursor-pointer hover:bg-accent-600 transition-colors sm:mt-5 w-fit">
            <Plus size={13} />
            {uploading ? 'Uploading…' : 'Upload File'}
            <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        )}
      </div>

      {needsPicker && noProjects ? (
        <EmptyState icon={FileText} title="No projects yet" description="Create a project first, then come back here to attach files to it." />
      ) : !resolvedProjectId ? (
        <EmptyState icon={Upload} title="Pick a project" description="Select a project above to view or upload its files." />
      ) : loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 rounded-lg border border-surface-400 bg-surface-200 animate-pulse" />
          ))}
        </div>
      ) : files.length === 0 ? (
        <EmptyState icon={FileText} title="No files yet" description="Upload contracts, assets or requirement docs for this project." />
      ) : (
        <div className="rounded-xl border border-surface-400 bg-surface-200 divide-y divide-surface-400">
          {files.map((f) => (
            <div key={f.id} className="flex items-center gap-2.5 text-sm px-4 py-2.5 hover:bg-surface-300/50 group">
              <FileText size={14} className="text-ink-500 shrink-0" />
              <span className="text-ink-200 truncate flex-1">{f.file_name}</span>
              <span className="text-ink-600 text-xs shrink-0 hidden sm:inline">{f.file_type || '—'}</span>
              <span className="text-ink-600 text-xs shrink-0">{formatBytes(f.file_size)}</span>
              <span className="text-ink-600 text-xs shrink-0 w-24 text-right hidden sm:inline">{formatDate(f.created_at)}</span>
              <button
                onClick={() => f.url && window.open(f.url, '_blank', 'noopener,noreferrer')}
                title="Open"
                className="text-ink-500 hover:text-accent-400 shrink-0"
              >
                <Download size={13} />
              </button>
              <button
                onClick={() => setDeleteId(f.id)}
                title="Delete"
                className="text-ink-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteId}
        title="Delete file?"
        message="This can't be undone."
        confirmLabel="Delete"
        danger
        onCancel={() => setDeleteId(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
