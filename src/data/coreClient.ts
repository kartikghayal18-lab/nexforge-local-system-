// REST client for the "core" business data (clients, projects, links, notes,
// files, settings, invoices, payments, dashboard stats). Replaces the old
// Tauri `invoke()` wrapper — same exported shape (`coreApi`, `isDesktop`)
// so pages need minimal changes, but every call now hits the Express API
// over HTTP with the JWT attached.
import { getToken, API_BASE_URL } from '../auth/AuthContext'
import type {
  Client, NewClient, UpdateClient,
  ProjectFull, NewProject, UpdateProject,
  ProjectLinkRecord, NewProjectLink,
  ProjectNote, NewProjectNote, UpdateProjectNote,
  ProjectFile, ProjectImage,
  Invoice, NewInvoice, UpdateInvoice,
  Payment, NewPayment,
  DashboardStats,
} from './coreTypes'

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  // A FormData body (multipart upload) must NOT get a forced
  // 'Content-Type: application/json' — the browser needs to set its own
  // multipart boundary, so we skip the default entirely for it.
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string> | undefined),
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Request failed: ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

const get = <T>(path: string) => request<T>(path)
const post = <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined })
const put = <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body: body !== undefined ? JSON.stringify(body) : undefined })
const del = <T>(path: string) => request<T>(path, { method: 'DELETE' })

// Kept for compatibility with existing page code that gates features on
// "desktop vs browser". There is no more desktop/browser distinction — the
// whole app now requires being signed in (see ProtectedRoute in App.tsx) —
// so this simply mirrors whether a session token is present.
export function isDesktop(): boolean {
  return !!getToken()
}

export const coreApi = {
  // Clients
  clientsList: () => get<Client[]>('/api/clients'),
  clientsCreate: (input: NewClient) => post<{ id: string }>('/api/clients', input).then((r) => r.id),
  clientsUpdate: (input: UpdateClient) => put<void>(`/api/clients/${input.id}`, input),
  clientsDelete: (id: string) => del<void>(`/api/clients/${id}`),

  // Projects
  projectsList: () => get<ProjectFull[]>('/api/projects'),
  projectsGet: (id: string) => get<ProjectFull | null>(`/api/projects/${id}`),
  projectsCreate: (input: NewProject) => post<{ id: string }>('/api/projects', input).then((r) => r.id),
  projectsUpdate: (input: UpdateProject) => put<void>(`/api/projects/${input.id}`, input),
  projectsDelete: (id: string) => del<void>(`/api/projects/${id}`),

  // Project links
  projectLinksList: (projectId: string) => get<ProjectLinkRecord[]>(`/api/projects/${projectId}/links`),
  projectLinksCreate: (input: NewProjectLink) =>
    post<{ id: string }>(`/api/projects/${input.project_id}/links`, input).then((r) => r.id),
  projectLinksDelete: (id: string) => del<void>(`/api/projects/links/${id}`),

  // Project notes
  projectNotesList: (projectId: string) => get<ProjectNote[]>(`/api/projects/${projectId}/notes`),
  projectNotesCreate: (input: NewProjectNote) =>
    post<{ id: string }>(`/api/projects/${input.project_id}/notes`, input).then((r) => r.id),
  projectNotesUpdate: (input: UpdateProjectNote) => put<void>(`/api/projects/notes/${input.id}`, input),
  projectNotesDelete: (id: string) => del<void>(`/api/projects/notes/${id}`),

  // Project images (cover + gallery) — uploaded via multipart POST straight
  // to the Express backend, which writes to its own local disk and returns
  // metadata only (see server/src/routes/projects.js + lib/storage).
  projectImagesList: (projectId: string) => get<ProjectImage[]>(`/api/projects/${projectId}/images`),
  projectImagesUpload: (projectId: string, file: File, isCover?: boolean) => {
    const formData = new FormData()
    formData.append('image', file)
    if (isCover !== undefined) formData.append('isCover', String(isCover))
    return request<ProjectImage>(`/api/projects/${projectId}/images`, { method: 'POST', body: formData })
  },
  projectImagesSetCover: (projectId: string, imageId: string) =>
    request<ProjectImage>(`/api/projects/${projectId}/images/${imageId}/cover`, { method: 'PATCH' }),
  projectImagesDelete: (projectId: string, imageId: string) => del<void>(`/api/projects/${projectId}/images/${imageId}`),
  // Records an already-existing static asset path (e.g. something committed
  // under the Vite frontend's public/images/projects/ and deployed by
  // Vercel) as a project image, without uploading any bytes.
  projectImagesAddStatic: (projectId: string, url: string, isCover?: boolean) =>
    post<ProjectImage>(`/api/projects/${projectId}/images/static`, { url, isCover }),

  // Project files (metadata + R2 presigned upload/download flow)
  projectFilesList: (projectId: string) => get<ProjectFile[]>(`/api/files/project/${projectId}`),
  projectFilesPresign: (projectId: string, args: { fileName: string; contentType?: string; size?: number }) =>
    post<{ uploadUrl: string; storageKey: string }>(`/api/files/project/${projectId}/presign`, args),
  projectFilesConfirm: (
    projectId: string,
    args: { fileName: string; contentType?: string; size: number; storageKey: string; url?: string; category?: string },
  ) => post<ProjectFile>(`/api/files/project/${projectId}/confirm`, args),
  projectFilesDownloadUrl: (id: string) => get<{ url: string }>(`/api/files/${id}/download`),
  projectFilesDelete: (id: string) => del<void>(`/api/files/${id}`),

  // Settings
  settingsGetAll: () => get<Record<string, string>>('/api/settings'),
  settingsSetMany: (values: Record<string, string>) => put<void>('/api/settings', values),

  // Invoices
  invoicesList: () => get<Invoice[]>('/api/invoices'),
  invoicesGet: (id: string) => get<Invoice>(`/api/invoices/${id}`),
  invoicesCreate: (input: NewInvoice) => post<{ id: string }>('/api/invoices', input).then((r) => r.id),
  invoicesUpdate: (input: UpdateInvoice) => put<void>(`/api/invoices/${input.id}`, input),
  invoicesSetStatus: (id: string, status: string) => post<void>(`/api/invoices/${id}/status`, { status }),
  invoicesDuplicate: (id: string) => post<{ id: string }>(`/api/invoices/${id}/duplicate`).then((r) => r.id),
  invoicesDelete: (id: string) => del<void>(`/api/invoices/${id}`),

  // Payments
  paymentsList: (invoiceId: string) => get<Payment[]>(`/api/payments/invoice/${invoiceId}`),
  paymentsCreate: (input: NewPayment) => post<{ id: string }>('/api/payments', input).then((r) => r.id),
  paymentsDelete: (id: string) => del<void>(`/api/payments/${id}`),

  // Dashboard
  dashboardStats: () => get<DashboardStats>('/api/dashboard/stats'),

  // Invoice PDF — returns the URL to open/print/download; auth header must
  // be attached by the caller (e.g. window.open won't include it, so pages
  // fetch the blob and open an object URL — see InvoiceView.tsx).
  invoicePdfUrl: (id: string) => `${API_BASE_URL}/api/invoices/${id}/pdf`,
  invoicesFetchPdfBlob: async (id: string): Promise<Blob> => {
    const token = getToken()
    const res = await fetch(`${API_BASE_URL}/api/invoices/${id}/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
    if (!res.ok) throw new Error('Failed to generate PDF')
    return res.blob()
  },
}
