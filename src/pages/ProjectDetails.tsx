import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Globe, Github, Rocket, ShieldCheck, BookOpen, Trash2, Pencil,
  Plus, FileText, Link2, Download, ExternalLink, Upload, ImageIcon, Star,
} from 'lucide-react'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Button } from '@/components/common/Button'
import { Input, Select, TextArea } from '@/components/common/Input'
import { Modal, ConfirmDialog } from '@/components/common/Modal'
import { useToast } from '@/hooks/useToast'
import { formatDate, todayISO } from '@/utils/format'
import { ProjectStatus } from '@/types'
import { ProjectVaultSummary } from '@/components/vault/ProjectVaultSummary'
import { coreApi } from '@/data/coreClient'
import { API_BASE_URL } from '@/auth/AuthContext'
import type { ProjectFull, UpdateProject, ProjectNote, ProjectLinkRecord, ProjectFile, ProjectImage } from '@/data/coreTypes'

const linkFields: { key: keyof import('@/types').Project; label: string; icon: any }[] = [
  { key: 'websiteUrl', label: 'Website URL', icon: Globe },
  { key: 'githubUrl', label: 'GitHub URL', icon: Github },
  { key: 'deploymentUrl', label: 'Deployment URL', icon: Rocket },
  { key: 'adminUrl', label: 'Admin Panel URL', icon: ShieldCheck },
  { key: 'docsUrl', label: 'Documentation URL', icon: BookOpen },
]

function imageSrc(url: string): string {
  // Backend returns a root-relative path (e.g. "/images/projects/...");
  // mirrors how invoicePdfUrl in coreClient.ts builds its URL.
  return url.startsWith('http') ? url : `${API_BASE_URL}${url}`
}

function friendlyError(e: unknown): string {
  console.error(e)
  // Surface the actual server-provided message (e.g. "Image is too large
  // (max 5MB)", "Only JPG, PNG and WebP images are allowed") instead of a
  // generic catch-all — CoreApiError's message IS the API response body's
  // `error` field (see coreClient.ts's request()).
  return e instanceof Error && e.message ? e.message : 'Something went wrong. Please try again.'
}

function formatBytes(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024

// Client-side check for fast feedback only — the real gate is server-side
// (MIME + magic-byte + size validation in server/src/lib/storage/index.js).
function validateImageClientSide(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return 'Only JPG, PNG or WebP images are allowed.'
  if (file.size > MAX_IMAGE_SIZE_BYTES) return 'Image is too large (5MB max).'
  return null
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // strip the "data:<mime>;base64," prefix
      const idx = result.indexOf(',')
      resolve(idx >= 0 ? result.slice(idx + 1) : result)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export default function ProjectDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { show } = useToast()

  const [project, setProject] = useState<ProjectFull | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [form, setForm] = useState<ProjectFull | null>(null)

  const [notes, setNotes] = useState<ProjectNote[]>([])
  const [links, setLinks] = useState<ProjectLinkRecord[]>([])
  const [files, setFiles] = useState<ProjectFile[]>([])
  const [noteModal, setNoteModal] = useState<{ id?: string; title: string; content: string } | null>(null)
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null)
  const [linkModal, setLinkModal] = useState(false)
  const [linkForm, setLinkForm] = useState({ type: 'website', label: '', url: '' })
  const [deleteLinkId, setDeleteLinkId] = useState<string | null>(null)
  const [deleteFileId, setDeleteFileId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const [images, setImages] = useState<ProjectImage[]>([])
  const [imageUploading, setImageUploading] = useState(false)
  const [deleteImageId, setDeleteImageId] = useState<string | null>(null)
  const [staticImagePath, setStaticImagePath] = useState('')
  const [staticImageSubmitting, setStaticImageSubmitting] = useState(false)

  async function loadProject() {
    if (!id) return
    setLoading(true)
    try {
      const p = await coreApi.projectsGet(id)
      if (!p) {
        setNotFound(true)
      } else {
        setProject(p)
      }
    } catch (e) {
      show(friendlyError(e), 'error')
    } finally {
      setLoading(false)
    }
  }

  async function loadNotes() {
    if (!id) return
    try {
      setNotes(await coreApi.projectNotesList(id))
    } catch (e) {
      show(friendlyError(e), 'error')
    }
  }
  async function loadLinks() {
    if (!id) return
    try {
      setLinks(await coreApi.projectLinksList(id))
    } catch (e) {
      show(friendlyError(e), 'error')
    }
  }
  async function loadFiles() {
    if (!id) return
    try {
      setFiles(await coreApi.projectFilesList(id))
    } catch (e) {
      show(friendlyError(e), 'error')
    }
  }
  async function loadImages() {
    if (!id) return
    try {
      setImages(await coreApi.projectImagesList(id))
    } catch (e) {
      show(friendlyError(e), 'error')
    }
  }

  useEffect(() => {
    loadProject()
    loadNotes()
    loadLinks()
    loadFiles()
    loadImages()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  function openEdit() {
    setForm(project)
    setEditOpen(true)
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return
    const input: UpdateProject = { ...form }
    try {
      await coreApi.projectsUpdate(input)
      show('Project updated')
      setEditOpen(false)
      loadProject()
    } catch (e) {
      show(friendlyError(e), 'error')
    }
  }

  async function remove() {
    if (!project) return
    try {
      await coreApi.projectsDelete(project.id)
      show('Project deleted')
      navigate('/projects')
    } catch (e) {
      show(friendlyError(e), 'error')
    }
  }

  // ---- Notes handlers ----
  function openNewNote() {
    setNoteModal({ title: '', content: '' })
  }
  async function saveNote(e: React.FormEvent) {
    e.preventDefault()
    if (!noteModal || !id) return
    try {
      if (noteModal.id) {
        await coreApi.projectNotesUpdate({ id: noteModal.id, title: noteModal.title, content: noteModal.content || null })
        show('Note updated')
      } else {
        await coreApi.projectNotesCreate({ project_id: id, title: noteModal.title || 'Untitled note', content: noteModal.content || null })
        show('Note added')
      }
      setNoteModal(null)
      loadNotes()
    } catch (e) {
      show(friendlyError(e), 'error')
    }
  }
  async function confirmDeleteNote() {
    if (!deleteNoteId) return
    try {
      await coreApi.projectNotesDelete(deleteNoteId)
      show('Note deleted')
      setDeleteNoteId(null)
      loadNotes()
    } catch (e) {
      show(friendlyError(e), 'error')
    }
  }

  // ---- Links handlers ----
  async function saveLink(e: React.FormEvent) {
    e.preventDefault()
    if (!id || !linkForm.url.trim()) return
    try {
      await coreApi.projectLinksCreate({ project_id: id, type: linkForm.type, url: linkForm.url.trim(), label: linkForm.label.trim() || null })
      show('Link added')
      setLinkModal(false)
      setLinkForm({ type: 'website', label: '', url: '' })
      loadLinks()
    } catch (e) {
      show(friendlyError(e), 'error')
    }
  }
  async function confirmDeleteLink() {
    if (!deleteLinkId) return
    try {
      await coreApi.projectLinksDelete(deleteLinkId)
      show('Link deleted')
      setDeleteLinkId(null)
      loadLinks()
    } catch (e) {
      show(friendlyError(e), 'error')
    }
  }

  // ---- Files handlers ----
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !id) return
    if (file.size > 20 * 1024 * 1024) {
      show('File is too large (20MB max).', 'error')
      return
    }
    setUploading(true)
    try {
      await coreApi.projectFilesUpload(id, file)
      show('File uploaded')
      loadFiles()
    } catch (e) {
      show(friendlyError(e), 'error')
    } finally {
      setUploading(false)
    }
  }
  function openFile(file: ProjectFile) {
    if (file.url) window.open(file.url, '_blank', 'noopener,noreferrer')
  }
  async function confirmDeleteFile() {
    if (!deleteFileId) return
    try {
      await coreApi.projectFilesDelete(deleteFileId)
      show('File deleted')
      setDeleteFileId(null)
      loadFiles()
    } catch (e) {
      show(friendlyError(e), 'error')
    }
  }

  // ---- Images handlers (cover + gallery) ----
  const coverImage = images.find((img) => img.is_cover) || null
  const galleryImages = images.filter((img) => !img.is_cover)

  // A 503 from the upload endpoint means "persistent storage isn't
  // configured yet in production" (see server/src/lib/storage/index.js) —
  // that's a clear, expected, actionable message from the server, not a
  // generic failure, so we show it verbatim instead of routing it through
  // friendlyError()'s catch-all "something went wrong".
  function isStorageNotConfiguredError(e: unknown): e is Error {
    return e instanceof Error && e.message.toLowerCase().includes('persistent image storage is not configured')
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>, isCover?: boolean) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !id) return
    const clientError = validateImageClientSide(file)
    if (clientError) {
      show(clientError, 'error')
      return
    }
    setImageUploading(true)
    try {
      await coreApi.projectImagesUpload(id, file, isCover)
      show('Image uploaded')
      loadImages()
    } catch (e) {
      show(isStorageNotConfiguredError(e) ? e.message : friendlyError(e), 'error')
    } finally {
      setImageUploading(false)
    }
  }

  async function handleAddStaticImage(isCover?: boolean) {
    const url = staticImagePath.trim()
    if (!id || !url) return
    setStaticImageSubmitting(true)
    try {
      await coreApi.projectImagesAddStatic(id, url, isCover)
      show('Image added')
      setStaticImagePath('')
      loadImages()
    } catch (e) {
      show(friendlyError(e), 'error')
    } finally {
      setStaticImageSubmitting(false)
    }
  }
  async function setImageAsCover(imageId: string) {
    if (!id) return
    try {
      await coreApi.projectImagesSetCover(id, imageId)
      show('Cover image updated')
      loadImages()
    } catch (e) {
      show(friendlyError(e), 'error')
    }
  }
  async function confirmDeleteImage() {
    if (!deleteImageId || !id) return
    try {
      await coreApi.projectImagesDelete(id, deleteImageId)
      show('Image deleted')
      setDeleteImageId(null)
      loadImages()
    } catch (e) {
      show(friendlyError(e), 'error')
    }
  }

  // ============================= RENDER =============================

  // -------- Desktop mode render --------

  if (loading) {
    return (
      <div className="max-w-4xl space-y-3">
        <div className="h-6 w-40 bg-surface-300 rounded animate-pulse" />
        <div className="h-32 bg-surface-200 border border-surface-400 rounded-xl animate-pulse" />
      </div>
    )
  }

  if (notFound || !project) {
    return (
      <div className="text-center py-20">
        <p className="text-sm text-ink-400">Project not found.</p>
        <button onClick={() => navigate('/projects')} className="mt-3 text-sm text-accent-400 hover:text-accent-300">
          Back to Projects
        </button>
      </div>
    )
  }

  const techTags = (project.tech_stack || '').split(',').map((t) => t.trim()).filter(Boolean)

  return (
    <div className="max-w-4xl">
      <button onClick={() => navigate('/projects')} className="inline-flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-100 mb-4 transition-colors">
        <ArrowLeft size={14} /> Back to Projects
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 className="text-xl font-semibold text-ink-100">{project.name}</h1>
            <StatusBadge status={project.status || 'Planning'} />
          </div>
          <p className="text-sm text-ink-400">{project.client || 'Unassigned'}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={<Pencil size={13} />} onClick={openEdit}>Edit</Button>
          <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={() => setConfirmDelete(true)}>Delete</Button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-4">
          <section className="rounded-xl border border-surface-400 bg-surface-200 p-4">
            <h2 className="text-sm font-semibold text-ink-100 mb-2">Overview</h2>
            <p className="text-sm text-ink-300 leading-relaxed">{project.description || 'No description added yet.'}</p>
            <div className="flex items-center gap-1.5 flex-wrap mt-3">
              {techTags.map((t) => (
                <span key={t} className="text-[11px] font-medium text-ink-400 bg-surface-300 border border-surface-500 rounded px-2 py-0.5">
                  {t}
                </span>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-surface-400 bg-surface-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-ink-100 flex items-center gap-1.5"><ImageIcon size={14} /> Images</h2>
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-1.5 rounded-lg bg-surface-300 border border-surface-500 text-ink-100 text-xs font-medium px-2.5 py-1.5 cursor-pointer hover:bg-surface-400 transition-colors">
                  <Pencil size={12} />
                  {coverImage ? 'Replace cover' : 'Set cover'}
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => handleImageUpload(e, true)} disabled={imageUploading} />
                </label>
                <label className="inline-flex items-center gap-1.5 rounded-lg bg-accent-500 text-white text-xs font-medium px-2.5 py-1.5 cursor-pointer hover:bg-accent-600 transition-colors">
                  <Plus size={13} />
                  {imageUploading ? 'Uploading…' : 'Add to gallery'}
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => handleImageUpload(e, false)} disabled={imageUploading} />
                </label>
              </div>
            </div>

            {/* Static image path — for images already committed under the
                Vite frontend's public/images/projects/ and deployed by
                Vercel. Records the path directly, no upload/bytes involved. */}
            <div className="flex items-center gap-2 mb-3">
              <input
                type="text"
                value={staticImagePath}
                onChange={(e) => setStaticImagePath(e.target.value)}
                placeholder="or paste an image path/URL (e.g. /images/projects/foo.png)"
                className="flex-1 min-w-0 rounded-lg border border-surface-500 bg-surface-300 px-3 py-2 text-xs text-ink-100 placeholder:text-ink-500 outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/40"
              />
              <button
                type="button"
                onClick={() => handleAddStaticImage(!coverImage)}
                disabled={!staticImagePath.trim() || staticImageSubmitting}
                className="shrink-0 rounded-lg border border-surface-500 bg-surface-300 px-3 py-2 text-xs font-medium text-ink-100 hover:bg-surface-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {staticImageSubmitting ? 'Adding…' : 'Add'}
              </button>
            </div>

            {/* Cover preview */}
            <div className="mb-3">
              {coverImage ? (
                <div className="relative group w-full max-w-sm">
                  <img src={imageSrc(coverImage.url)} alt="Project cover" className="w-full aspect-video object-cover rounded-lg border border-surface-400" />
                  <button
                    onClick={() => setDeleteImageId(coverImage.id)}
                    title="Remove cover image"
                    className="absolute top-2 right-2 rounded-md bg-surface-100/90 text-ink-200 hover:text-rose-400 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ) : (
                <div className="w-full max-w-sm aspect-video rounded-lg border border-dashed border-surface-500 bg-surface-300/40 flex flex-col items-center justify-center gap-1.5 text-ink-500">
                  <ImageIcon size={22} />
                  <span className="text-xs">No cover image yet</span>
                </div>
              )}
            </div>

            {/* Gallery */}
            {galleryImages.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {galleryImages.map((img) => (
                  <div key={img.id} className="relative group aspect-square">
                    <img src={imageSrc(img.url)} alt={img.file_name || 'Project image'} className="w-full h-full object-cover rounded-lg border border-surface-400" />
                    <div className="absolute inset-0 rounded-lg bg-black/0 group-hover:bg-black/40 transition-colors" />
                    <div className="absolute top-1 right-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setImageAsCover(img.id)} title="Set as cover" className="rounded-md bg-surface-100/90 text-ink-200 hover:text-accent-400 p-1">
                        <Star size={12} />
                      </button>
                      <button onClick={() => setDeleteImageId(img.id)} title="Delete image" className="rounded-md bg-surface-100/90 text-ink-200 hover:text-rose-400 p-1">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-surface-400 bg-surface-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-ink-100 flex items-center gap-1.5"><Link2 size={14} /> Links</h2>
              <Button size="sm" variant="secondary" icon={<Plus size={13} />} onClick={() => setLinkModal(true)}>Add Link</Button>
            </div>
            {links.length === 0 ? (
              <p className="text-sm text-ink-600">No links added yet.</p>
            ) : (
              <div className="space-y-2">
                {links.map((l) => (
                  <div key={l.id} className="flex items-center gap-2.5 text-sm group">
                    <span className="text-ink-500 w-24 shrink-0 capitalize">{l.type}</span>
                    <a href={l.url} target="_blank" rel="noreferrer" className="text-accent-400 hover:text-accent-300 truncate flex-1">
                      {l.label || l.url}
                    </a>
                    <ExternalLink size={12} className="text-ink-500 shrink-0" />
                    <button onClick={() => setDeleteLinkId(l.id)} className="text-ink-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-surface-400 bg-surface-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-ink-100 flex items-center gap-1.5"><FileText size={14} /> Notes</h2>
              <Button size="sm" variant="secondary" icon={<Plus size={13} />} onClick={openNewNote}>Add Note</Button>
            </div>
            {notes.length === 0 ? (
              <p className="text-sm text-ink-600">No notes yet.</p>
            ) : (
              <div className="space-y-2">
                {notes.map((n) => (
                  <div key={n.id} className="rounded-lg border border-surface-400 bg-surface-300/40 p-3 group">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-medium text-ink-100">{n.title}</h3>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button onClick={() => setNoteModal({ id: n.id, title: n.title, content: n.content || '' })} className="text-ink-500 hover:text-ink-100">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => setDeleteNoteId(n.id)} className="text-ink-500 hover:text-rose-400">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    {n.content && <p className="text-xs text-ink-400 mt-1 whitespace-pre-line">{n.content}</p>}
                    <div className="text-[11px] text-ink-600 mt-2">Updated {formatDate(n.updated_at)}</div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-surface-400 bg-surface-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-ink-100 flex items-center gap-1.5"><Upload size={14} /> Files</h2>
              <label className="inline-flex items-center gap-1.5 rounded-lg bg-accent-500 text-white text-xs font-medium px-2.5 py-1.5 cursor-pointer hover:bg-accent-600 transition-colors">
                <Plus size={13} />
                {uploading ? 'Uploading…' : 'Upload File'}
                <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
              </label>
            </div>
            {files.length === 0 ? (
              <p className="text-sm text-ink-600">No files uploaded yet.</p>
            ) : (
              <div className="space-y-1.5">
                {files.map((f) => (
                  <div key={f.id} className="flex items-center gap-2.5 text-sm rounded-lg px-2 py-1.5 hover:bg-surface-300/50 group">
                    <FileText size={14} className="text-ink-500 shrink-0" />
                    <span className="text-ink-200 truncate flex-1">{f.file_name}</span>
                    <span className="text-ink-600 text-xs shrink-0">{formatBytes(f.file_size)}</span>
                    <span className="text-ink-600 text-xs shrink-0 w-20 text-right">{formatDate(f.created_at)}</span>
                    <button onClick={() => openFile(f)} title="Open" className="text-ink-500 hover:text-accent-400 shrink-0">
                      <Download size={13} />
                    </button>
                    <button onClick={() => setDeleteFileId(f.id)} title="Delete" className="text-ink-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-xl border border-surface-400 bg-surface-200 p-4">
            <h2 className="text-sm font-semibold text-ink-100 mb-3">Technology</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-ink-500">Framework</dt><dd className="text-ink-200">{project.framework || '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-500">Backend</dt><dd className="text-ink-200">{project.backend || '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-500">Database</dt><dd className="text-ink-200">{project.database_type || '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-500">Hosting</dt><dd className="text-ink-200">{project.hosting || '—'}</dd></div>
            </dl>
            <div className="text-xs text-ink-500 mt-3 pt-3 border-t border-surface-400">Last updated {formatDate(project.updated_at)}</div>
          </section>

          <ProjectVaultSummary projectId={project.id} />
        </div>
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Project" size="lg">
        {form && (
          <form onSubmit={saveEdit} className="space-y-3 max-h-[70vh] overflow-y-auto scrollbar-thin pr-1">
            <div className="grid sm:grid-cols-2 gap-3">
              <Input label="Project name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input label="Client" value={form.client ?? ''} onChange={(e) => setForm({ ...form, client: e.target.value })} />
            </div>
            <TextArea label="Description" rows={2} value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div className="grid sm:grid-cols-2 gap-3">
              <Select label="Status" value={form.status ?? 'Planning'} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {(['Active', 'Planning', 'Completed', 'Archived'] as ProjectStatus[]).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
              <Input label="Technology (comma separated)" value={form.tech_stack ?? ''} onChange={(e) => setForm({ ...form, tech_stack: e.target.value })} />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Input label="Framework" value={form.framework ?? ''} onChange={(e) => setForm({ ...form, framework: e.target.value })} />
              <Input label="Backend" value={form.backend ?? ''} onChange={(e) => setForm({ ...form, backend: e.target.value })} />
              <Input label="Database" value={form.database_type ?? ''} onChange={(e) => setForm({ ...form, database_type: e.target.value })} />
              <Input label="Hosting" value={form.hosting ?? ''} onChange={(e) => setForm({ ...form, hosting: e.target.value })} />
            </div>
            <Input label="Live URL" value={form.live_url ?? ''} onChange={(e) => setForm({ ...form, live_url: e.target.value })} />
            <Input label="Repository URL" value={form.repository_url ?? ''} onChange={(e) => setForm({ ...form, repository_url: e.target.value })} />
            <Input label="Staging URL" value={form.staging_url ?? ''} onChange={(e) => setForm({ ...form, staging_url: e.target.value })} />
            <TextArea label="Notes" rows={3} value={form.notes ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <div className="flex items-center justify-end gap-2 pt-1 sticky bottom-0 bg-surface-200 pb-1">
              <button type="button" onClick={() => setEditOpen(false)} className="rounded-lg border border-surface-500 bg-surface-300 px-3.5 py-2 text-sm text-ink-100 hover:bg-surface-400 transition-colors">
                Cancel
              </button>
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={!!noteModal} onClose={() => setNoteModal(null)} title={noteModal?.id ? 'Edit Note' : 'Add Note'}>
        {noteModal && (
          <form onSubmit={saveNote} className="space-y-3">
            <Input label="Title" required value={noteModal.title} onChange={(e) => setNoteModal({ ...noteModal, title: e.target.value })} />
            <TextArea label="Content" rows={5} value={noteModal.content} onChange={(e) => setNoteModal({ ...noteModal, content: e.target.value })} />
            <div className="flex items-center justify-end gap-2 pt-1">
              <button type="button" onClick={() => setNoteModal(null)} className="rounded-lg border border-surface-500 bg-surface-300 px-3.5 py-2 text-sm text-ink-100 hover:bg-surface-400 transition-colors">
                Cancel
              </button>
              <Button type="submit">Save Note</Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={linkModal} onClose={() => setLinkModal(false)} title="Add Link">
        <form onSubmit={saveLink} className="space-y-3">
          <Select label="Type" value={linkForm.type} onChange={(e) => setLinkForm({ ...linkForm, type: e.target.value })}>
            <option value="website">Website</option>
            <option value="github">GitHub</option>
            <option value="deployment">Deployment</option>
            <option value="admin">Admin Panel</option>
            <option value="docs">Documentation</option>
            <option value="other">Other</option>
          </Select>
          <Input label="Label (optional)" value={linkForm.label} onChange={(e) => setLinkForm({ ...linkForm, label: e.target.value })} />
          <Input label="URL" required value={linkForm.url} onChange={(e) => setLinkForm({ ...linkForm, url: e.target.value })} placeholder="https://…" />
          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={() => setLinkModal(false)} className="rounded-lg border border-surface-500 bg-surface-300 px-3.5 py-2 text-sm text-ink-100 hover:bg-surface-400 transition-colors">
              Cancel
            </button>
            <Button type="submit">Add Link</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete Project"
        message={`Are you sure you want to delete "${project.name}"? This also removes its notes, links and files. This can't be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
      <ConfirmDialog
        open={!!deleteNoteId}
        title="Delete Note"
        message="Delete this note? This can't be undone."
        confirmLabel="Delete"
        danger
        onConfirm={confirmDeleteNote}
        onCancel={() => setDeleteNoteId(null)}
      />
      <ConfirmDialog
        open={!!deleteLinkId}
        title="Delete Link"
        message="Delete this link?"
        confirmLabel="Delete"
        danger
        onConfirm={confirmDeleteLink}
        onCancel={() => setDeleteLinkId(null)}
      />
      <ConfirmDialog
        open={!!deleteFileId}
        title="Delete File"
        message="Delete this file? This can't be undone."
        confirmLabel="Delete"
        danger
        onConfirm={confirmDeleteFile}
        onCancel={() => setDeleteFileId(null)}
      />
      <ConfirmDialog
        open={!!deleteImageId}
        title="Delete Image"
        message="Delete this image? This can't be undone."
        confirmLabel="Delete"
        danger
        onConfirm={confirmDeleteImage}
        onCancel={() => setDeleteImageId(null)}
      />
    </div>
  )
}
