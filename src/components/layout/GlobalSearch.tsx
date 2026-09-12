import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, FolderKanban, FileText, Users, KeyRound, Lock, Database as DbIcon, StickyNote, Paperclip } from 'lucide-react'
import { useProjects, useInvoices, useClients } from '@/hooks/useStore'
import { useVault } from '@/vault/VaultContext'
import { vaultApi } from '@/vault/tauriClient'
import { coreApi, isDesktop } from '@/data/coreClient'
import type { ProjectFull, Invoice as DbInvoice, Client as DbClient, ProjectNote, ProjectFile } from '@/data/coreTypes'

interface Result {
  id: string
  label: string
  sublabel: string
  icon: any
  go: () => void
}

export function GlobalSearch() {
  const navigate = useNavigate()
  const desktop = isDesktop()

  // Browser-mode demo data
  const [legacyProjects] = useProjects()
  const [legacyInvoices] = useInvoices()
  const [legacyClients] = useClients()

  // Desktop-mode real data, fetched once and filtered client-side.
  const [dbProjects, setDbProjects] = useState<ProjectFull[]>([])
  const [dbInvoices, setDbInvoices] = useState<DbInvoice[]>([])
  const [dbClients, setDbClients] = useState<DbClient[]>([])
  const [dbNotes, setDbNotes] = useState<(ProjectNote & { project_name: string })[]>([])
  const [dbFiles, setDbFiles] = useState<(ProjectFile & { project_name: string })[]>([])

  const { desktop: vaultDesktop, unlocked } = useVault()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [vaultNames, setVaultNames] = useState<{ secrets: { id: string; name: string; project_id: string | null }[]; passwords: { id: string; title: string; project_id: string | null }[]; databases: { id: string; name: string; project_id: string | null }[] }>({ secrets: [], passwords: [], databases: [] })

  useEffect(() => {
    if (!vaultDesktop || !unlocked) return
    // Metadata only — names/titles never values — fetched once and filtered client-side.
    Promise.all([vaultApi.secretsList(null), vaultApi.passwordsList(null), vaultApi.databasesList(null)]).then(([s, p, d]) => {
      setVaultNames({
        secrets: s.map((x) => ({ id: x.id, name: x.name, project_id: x.project_id })),
        passwords: p.map((x) => ({ id: x.id, title: x.title, project_id: x.project_id })),
        databases: d.map((x) => ({ id: x.id, name: x.name, project_id: x.project_id })),
      })
    }).catch(() => {})
  }, [vaultDesktop, unlocked])

  useEffect(() => {
    if (!desktop) return
    ;(async () => {
      try {
        const [projects, invoices, clients] = await Promise.all([
          coreApi.projectsList(),
          coreApi.invoicesList(),
          coreApi.clientsList(),
        ])
        setDbProjects(projects)
        setDbInvoices(invoices)
        setDbClients(clients)

        const notesLists = await Promise.all(projects.map((p) => coreApi.projectNotesList(p.id).catch(() => [])))
        const filesLists = await Promise.all(projects.map((p) => coreApi.projectFilesList(p.id).catch(() => [])))
        setDbNotes(projects.flatMap((p, i) => notesLists[i].map((n) => ({ ...n, project_name: p.name }))))
        setDbFiles(projects.flatMap((p, i) => filesLists[i].map((f) => ({ ...f, project_name: p.name }))))
      } catch (e) {
        console.error(e)
      }
    })()
  }, [desktop])

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const out: Result[] = []

    if (desktop) {
      dbProjects.filter((p) => p.name.toLowerCase().includes(q) || (p.client || '').toLowerCase().includes(q)).slice(0, 4).forEach((p) => {
        out.push({ id: `proj-${p.id}`, label: p.name, sublabel: 'Project', icon: FolderKanban, go: () => navigate(`/projects/${p.id}`) })
      })
      dbInvoices.filter((i) => i.invoice_number.toLowerCase().includes(q)).slice(0, 4).forEach((i) => {
        out.push({ id: `inv-${i.id}`, label: i.invoice_number, sublabel: 'Invoice', icon: FileText, go: () => navigate(`/invoices/${i.id}`) })
      })
      dbClients.filter((c) => (c.company || '').toLowerCase().includes(q) || (c.name || '').toLowerCase().includes(q)).slice(0, 4).forEach((c) => {
        out.push({ id: `cli-${c.id}`, label: c.company || c.name || 'Client', sublabel: 'Client', icon: Users, go: () => navigate('/clients') })
      })
      dbNotes.filter((n) => n.title.toLowerCase().includes(q) || (n.content || '').toLowerCase().includes(q)).slice(0, 4).forEach((n) => {
        out.push({ id: `note-${n.id}`, label: n.title, sublabel: `Note · ${n.project_name}`, icon: StickyNote, go: () => navigate(`/projects/${n.project_id}`) })
      })
      dbFiles.filter((f) => f.original_name.toLowerCase().includes(q)).slice(0, 4).forEach((f) => {
        out.push({ id: `file-${f.id}`, label: f.original_name, sublabel: `File · ${f.project_name}`, icon: Paperclip, go: () => navigate(`/projects/${f.project_id}`) })
      })
    } else {
      legacyProjects.filter((p) => p.name.toLowerCase().includes(q) || p.client.toLowerCase().includes(q)).slice(0, 4).forEach((p) => {
        out.push({ id: `proj-${p.id}`, label: p.name, sublabel: 'Project', icon: FolderKanban, go: () => navigate(`/projects/${p.id}`) })
      })
      legacyInvoices.filter((i) => i.invoiceNumber.toLowerCase().includes(q) || i.billTo.name.toLowerCase().includes(q)).slice(0, 4).forEach((i) => {
        out.push({ id: `inv-${i.id}`, label: i.invoiceNumber, sublabel: `Invoice · ${i.billTo.name}`, icon: FileText, go: () => navigate(`/invoices/${i.id}`) })
      })
      legacyClients.filter((c) => c.company.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)).slice(0, 4).forEach((c) => {
        out.push({ id: `cli-${c.id}`, label: c.company, sublabel: 'Client', icon: Users, go: () => navigate('/clients') })
      })
    }

    vaultNames.secrets.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 4).forEach((s) => {
      out.push({ id: `sec-${s.id}`, label: s.name, sublabel: 'Secret · name only', icon: KeyRound, go: () => navigate(s.project_id ? `/projects/${s.project_id}/vault?tab=env` : '/secrets') })
    })
    vaultNames.passwords.filter((p) => p.title.toLowerCase().includes(q)).slice(0, 4).forEach((p) => {
      out.push({ id: `pwd-${p.id}`, label: p.title, sublabel: 'Password · title only', icon: Lock, go: () => navigate(p.project_id ? `/projects/${p.project_id}/vault?tab=passwords` : '/passwords') })
    })
    vaultNames.databases.filter((d) => d.name.toLowerCase().includes(q)).slice(0, 4).forEach((d) => {
      out.push({ id: `db-${d.id}`, label: d.name, sublabel: 'Database · name only', icon: DbIcon, go: () => navigate(d.project_id ? `/projects/${d.project_id}/vault?tab=databases` : '/projects') })
    })

    return out.slice(0, 10)
  }, [query, desktop, dbProjects, dbInvoices, dbClients, dbNotes, dbFiles, legacyProjects, legacyInvoices, legacyClients, vaultNames, navigate])

  return (
    <div className="relative flex-1 max-w-md">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search projects, clients, invoices, notes, files…"
        className="w-full rounded-lg border border-surface-500 bg-surface-300 pl-9 pr-3 py-2 text-sm text-ink-100 placeholder:text-ink-500 outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/40 transition-colors"
      />
      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 mt-1.5 rounded-lg border border-surface-400 bg-surface-200 shadow-panel overflow-hidden z-30">
          {results.map((r) => (
            <button
              key={r.id}
              onMouseDown={() => { r.go(); setOpen(false); setQuery('') }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-surface-300 transition-colors"
            >
              <r.icon size={14} className="text-ink-500 shrink-0" />
              <div className="min-w-0">
                <div className="text-sm text-ink-100 truncate">{r.label}</div>
                <div className="text-[11px] text-ink-500">{r.sublabel}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
