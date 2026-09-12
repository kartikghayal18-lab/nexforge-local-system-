// Types mirroring the Rust structs in src-tauri/src/models.rs (core.rs commands).
// Field names match the Rust struct fields verbatim (snake_case) since no
// serde rename_all is applied to these structs.

export interface Client {
  id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  address: string | null
  website: string | null
  gstin: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type NewClient = Omit<Client, 'id' | 'created_at' | 'updated_at'>
export type UpdateClient = Omit<Client, 'created_at' | 'updated_at'>

export interface ProjectFull {
  id: string
  name: string
  client_id: string | null
  client: string | null
  description: string | null
  status: string | null
  category: string | null
  tech_stack: string | null
  framework: string | null
  backend: string | null
  database_type: string | null
  hosting: string | null
  repository_url: string | null
  live_url: string | null
  staging_url: string | null
  start_date: string | null
  deadline: string | null
  budget: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type NewProject = Omit<ProjectFull, 'id' | 'created_at' | 'updated_at'>
export type UpdateProject = Omit<ProjectFull, 'created_at' | 'updated_at'>

export interface ProjectLinkRecord {
  id: string
  project_id: string
  type: string
  url: string
  label: string | null
}
export type NewProjectLink = Omit<ProjectLinkRecord, 'id'>

export interface ProjectNote {
  id: string
  project_id: string
  title: string
  content: string | null
  created_at: string
  updated_at: string
}
export type NewProjectNote = Omit<ProjectNote, 'id' | 'created_at' | 'updated_at'>
export type UpdateProjectNote = Pick<ProjectNote, 'id' | 'title' | 'content'>

export interface ProjectImage {
  id: string
  project_id: string
  url: string
  storage_key: string
  is_cover: boolean
  file_name: string | null
  file_size: number | null
  mime_type: string | null
  created_at: string
}

export interface ProjectFile {
  id: string
  project_id: string
  name: string
  original_name: string
  file_type: string | null
  file_size: number
  category: string | null
  created_at: string
}

export interface InvoiceItemRow {
  id: string
  description: string
  quantity: number
  rate: number
  amount: number
}
export interface InvoiceItemInput {
  description: string
  quantity: number
  rate: number
}

export type InvoiceStatus = 'Draft' | 'Sent' | 'Paid' | 'Partially Paid' | 'Overdue' | 'Cancelled'

export interface Invoice {
  id: string
  invoice_number: string
  client_id: string | null
  project_id: string | null
  issue_date: string
  due_date: string
  status: string
  currency: string
  subtotal: number
  discount: number
  tax: number
  total: number
  notes: string | null
  payment_terms: string | null
  created_at: string
  updated_at: string
  items: InvoiceItemRow[]
  amount_paid: number
}

export interface NewInvoice {
  invoice_number?: string | null
  client_id: string | null
  project_id: string | null
  issue_date: string
  due_date: string
  status: string
  currency: string
  discount: number
  tax_rate_percent: number
  notes: string | null
  payment_terms: string | null
  items: InvoiceItemInput[]
}

export interface UpdateInvoice {
  id: string
  client_id: string | null
  project_id: string | null
  issue_date: string
  due_date: string
  status: string
  currency: string
  discount: number
  tax_rate_percent: number
  notes: string | null
  payment_terms: string | null
  items: InvoiceItemInput[]
}

export interface Payment {
  id: string
  invoice_id: string
  amount: number
  payment_date: string
  payment_method: string | null
  reference: string | null
  notes: string | null
  created_at: string
}
export type NewPayment = Omit<Payment, 'id' | 'created_at'>

export interface DashboardStats {
  total_projects: number
  total_clients: number
  total_invoices: number
  paid_invoices: number
  pending_invoices: number
  overdue_invoices: number
  total_revenue: number
  outstanding_amount: number
}
