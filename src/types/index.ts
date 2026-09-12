export type ProjectStatus = 'Active' | 'Planning' | 'Completed' | 'Archived'

export interface Project {
  id: string
  name: string
  client: string
  description: string
  technology: string[]
  framework?: string
  backend?: string
  database?: string
  hosting?: string
  status: ProjectStatus
  updatedAt: string
  createdAt: string
  websiteUrl?: string
  githubUrl?: string
  deploymentUrl?: string
  adminUrl?: string
  docsUrl?: string
  notes?: string
}

export type InvoiceStatus = 'Draft' | 'Sent' | 'Paid' | 'Overdue'

export interface InvoiceItem {
  id: string
  description: string
  quantity: number
  rate: number
}

export type GstMode = 'CGST_SGST' | 'IGST'

export interface PartyDetails {
  name: string
  contactPerson?: string
  address: string
  city: string
  state: string
  pin: string
  country?: string
  phone: string
  email: string
  website?: string
  gstin?: string
}

export interface PaymentDetails {
  bankName: string
  accountName: string
  accountNumber: string
  ifsc: string
  upi: string
}

export interface Invoice {
  id: string
  invoiceNumber: string
  issueDate: string
  dueDate: string
  paymentTerms: string
  from: PartyDetails
  billTo: PartyDetails
  items: InvoiceItem[]
  discountType: 'percentage' | 'fixed'
  discountValue: number
  gstMode: GstMode
  gstPercentage: number
  additionalCharge: number
  additionalChargeLabel: string
  notes: string
  terms: string
  payment: PaymentDetails
  status: InvoiceStatus
  createdAt: string
  updatedAt: string
}

export interface Client {
  id: string
  name: string
  company: string
  email: string
  phone: string
  projects: number
  totalInvoiced: number
}

export interface NoteItem {
  id: string
  title: string
  body: string
  projectId?: string
  updatedAt: string
}

export interface SecretItem {
  id: string
  name: string
  project?: string
  category: string
  environment: string
  updatedAt: string
}

export interface PasswordItem {
  id: string
  service: string
  username: string
  project?: string
  url?: string
  updatedAt: string
}
