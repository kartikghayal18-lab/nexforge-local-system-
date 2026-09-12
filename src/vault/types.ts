export type VaultEnvironment = 'Development' | 'Staging' | 'Production' | 'Shared'

export const VAULT_ENVIRONMENTS: VaultEnvironment[] = ['Development', 'Staging', 'Production', 'Shared']

export const SECRET_CATEGORIES = [
  'API Key',
  'API Secret',
  'Database URL',
  'Database Password',
  'Authentication',
  'Email',
  'Firebase',
  'Supabase',
  'Neon',
  'Payment Gateway',
  'Hosting',
  'GitHub',
  'Vercel',
  'Token',
  'Webhook',
  'Custom',
] as const

export type SecretCategory = (typeof SECRET_CATEGORIES)[number]

export const DATABASE_PROVIDERS = [
  'PostgreSQL',
  'MySQL',
  'MongoDB',
  'Supabase',
  'Neon',
  'Firebase',
  'SQLite',
  'Other',
] as const

export type DatabaseProvider = (typeof DATABASE_PROVIDERS)[number]

export interface VaultStatus {
  initialized: boolean
  unlocked: boolean
  auto_lock_minutes: number
}

export interface SecretRecord {
  id: string
  project_id: string | null
  name: string
  category: string
  environment: string
  notes: string | null
  created_at: string
  updated_at: string
}

export interface NewSecretInput {
  project_id: string | null
  name: string
  category: string
  environment: string
  value: string
  notes: string | null
}

export interface UpdateSecretInput {
  id: string
  name: string
  category: string
  environment: string
  notes: string | null
  new_value: string | null
}

export interface PasswordRecord {
  id: string
  project_id: string | null
  title: string
  username: string | null
  website_url: string | null
  environment: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface NewPasswordInput {
  project_id: string | null
  title: string
  username: string | null
  password: string
  website_url: string | null
  environment: string | null
  notes: string | null
}

export interface UpdatePasswordInput {
  id: string
  title: string
  username: string | null
  website_url: string | null
  environment: string | null
  notes: string | null
  new_password: string | null
}

export interface DatabaseRecord {
  id: string
  project_id: string | null
  name: string
  provider: string
  host: string | null
  port: string | null
  database_name: string | null
  username: string | null
  environment: string | null
  has_connection_string: boolean
  has_password: boolean
  created_at: string
  updated_at: string
}

export interface NewDatabaseInput {
  project_id: string | null
  name: string
  provider: string
  host: string | null
  port: string | null
  database_name: string | null
  username: string | null
  connection_string: string | null
  password: string | null
  environment: string | null
}

export interface UpdateDatabaseInput {
  id: string
  name: string
  provider: string
  host: string | null
  port: string | null
  database_name: string | null
  username: string | null
  environment: string | null
  new_connection_string: string | null
  new_password: string | null
}

export interface DatabaseSecrets {
  connection_string: string | null
  password: string | null
}

export interface ProjectMigrateInput {
  id: string
  name: string
  client: string | null
  description: string | null
  status: string | null
  framework: string | null
  backend: string | null
  database_type: string | null
  hosting: string | null
  created_at: string
  updated_at: string
}
