import { useLocalStorage } from './useLocalStorage'
import {
  SEED_PROJECTS,
  SEED_INVOICES,
  SEED_CLIENTS,
  SEED_NOTES,
  SEED_SECRETS,
  SEED_PASSWORDS,
} from '@/data/seed'
import { Project, Invoice, Client, NoteItem, SecretItem, PasswordItem } from '@/types'

export function useProjects() {
  return useLocalStorage<Project[]>('projects', SEED_PROJECTS)
}
export function useInvoices() {
  return useLocalStorage<Invoice[]>('invoices', SEED_INVOICES)
}
export function useClients() {
  return useLocalStorage<Client[]>('clients', SEED_CLIENTS)
}
export function useNotes() {
  return useLocalStorage<NoteItem[]>('notes', SEED_NOTES)
}
export function useSecrets() {
  return useLocalStorage<SecretItem[]>('secrets', SEED_SECRETS)
}
export function usePasswords() {
  return useLocalStorage<PasswordItem[]>('passwords', SEED_PASSWORDS)
}
