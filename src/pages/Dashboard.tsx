import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FolderKanban,
  KeyRound,
  FileText,
  Users,
  Plus,
  FilePlus2,
  FolderPlus,
  Upload,
  NotebookPen,
  FileDown,
  Database as DbIcon,
  ChevronRight,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Button } from '@/components/common/Button'
import { Modal } from '@/components/common/Modal'
import { AddSecretModal } from '@/components/vault/AddSecretModal'
import { AddPasswordModal } from '@/components/vault/AddPasswordModal'
import { AddDatabaseModal } from '@/components/vault/AddDatabaseModal'
import { ImportEnvModal } from '@/components/vault/ImportEnvModal'
import { useProjects, useInvoices, useClients } from '@/hooks/useStore'
import { useVault } from '@/vault/VaultContext'
import { vaultApi } from '@/vault/tauriClient'
import { formatINR } from '@/utils/format'
import { computeInvoiceTotals } from '@/utils/invoice'
import { coreApi, isDesktop } from '@/data/coreClient'
import type { DashboardStats, ProjectFull, Invoice as DbInvoice } from '@/data/coreTypes'

export default function Dashboard() {
  const navigate = useNavigate()
  const desktop = isDesktop()

  // Legacy localStorage demo data (browser mode fallback).
  const [legacyProjects] = useProjects()
  const [legacyInvoices] = useInvoices()
  const [legacyClients] = useClients()

  const { unlocked } = useVault()
  const [secretsCount, setSecretsCount] = useState<number | null>(null)
  const [comingSoon, setComingSoon] = useState<string | null>(null)

  const [showAddSecret, setShowAddSecret] = useState(false)
  const [showAddPassword, setShowAddPassword] = useState(false)
  const [showImportEnv, setShowImportEnv] = useState(false)
  const [showAddDatabase, setShowAddDatabase] = useState(false)

  // Desktop-mode real data
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [dbProjects, setDbProjects] = useState<ProjectFull[]>([])
  const [dbInvoices, setDbInvoices] = useState<DbInvoice[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (desktop && unlocked) {
      vaultApi.secretsList(null).then((s) => setSecretsCount(s.length)).catch(() => setSecretsCount(null))
    } else {
      setSecretsCount(null)
    }
  }, [desktop, unlocked])

  useEffect(() => {
    if (!desktop) return
    ;(async () => {
      try {
        const [s, p, inv] = await Promise.all([coreApi.dashboardStats(), coreApi.projectsList(), coreApi.invoicesList()])
        setStats(s)
        setDbProjects(p)
        setDbInvoices(inv)
      } catch (e) {
        console.error(e)
        setLoadError('Could not load dashboard data.')
      }
    })()
  }, [desktop])

  const recentProjects = desktop
    ? [...dbProjects].sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at)).slice(0, 5)
    : [...legacyProjects].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)).slice(0, 5)

  const recentInvoices = desktop
    ? [...dbInvoices].sort((a, b) => +new Date(b.issue_date) - +new Date(a.issue_date)).slice(0, 5)
    : [...legacyInvoices].sort((a, b) => +new Date(b.issueDate) - +new Date(a.issueDate)).slice(0, 5)

  const projectsCount = desktop ? (stats?.total_projects ?? dbProjects.length) : legacyProjects.length
  const invoicesCount = desktop ? (stats?.total_invoices ?? dbInvoices.length) : legacyInvoices.length
  const clientsCount = desktop ? (stats?.total_clients ?? 0) : legacyClients.length

  const quickActions = [
    { label: 'Create New Invoice', icon: FilePlus2, action: () => navigate('/invoices/new') },
    { label: 'Add New Project', icon: FolderPlus, action: () => navigate('/projects?new=1') },
    { label: 'Add Secret', icon: KeyRound, action: () => setShowAddSecret(true) },
    { label: 'Add Password', icon: KeyRound, action: () => setShowAddPassword(true) },
    { label: 'Import .env', icon: FileDown, action: () => setShowImportEnv(true) },
    { label: 'Add Database', icon: DbIcon, action: () => setShowAddDatabase(true) },
    { label: 'Upload File', icon: Upload, action: () => setComingSoon('File Storage') },
    { label: 'Add Note', icon: NotebookPen, action: () => navigate('/notes?new=1') },
  ]

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Everything important, in one place."
        actions={
          <Button icon={<Plus size={15} />} onClick={() => navigate('/projects?new=1')}>
            New Project
          </Button>
        }
      />

      {!desktop && (
        <div className="mb-4 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-400">
          Demo data — open this app in Desktop Mode to see your real projects, invoices and clients here.
        </div>
      )}
      {loadError && (
        <div className="mb-4 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-400">
          {loadError}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Projects" value={projectsCount} hint="Active projects" icon={FolderKanban} tone="accent" />
        <StatCard
          label="Secrets Stored"
          value={secretsCount ?? (desktop ? '—' : 'Locked')}
          hint={desktop ? (unlocked ? 'API keys, tokens, etc.' : 'Unlock vault to view') : 'Requires Desktop Mode'}
          icon={KeyRound}
          tone="amber"
        />
        <StatCard label="Invoices" value={invoicesCount} hint="Total invoices" icon={FileText} tone="emerald" />
        <StatCard label="Clients" value={clientsCount} hint="Total clients" icon={Users} tone="default" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-surface-400 bg-surface-200 shadow-soft">
          <div className="flex items-center justify-between px-4 py-3 border-b border-surface-400">
            <h2 className="text-sm font-semibold text-ink-100">Recent Projects</h2>
            <button onClick={() => navigate('/projects')} className="text-xs text-accent-400 hover:text-accent-300 inline-flex items-center gap-0.5">
              View All <ChevronRight size={13} />
            </button>
          </div>
          <div className="divide-y divide-surface-400">
            {recentProjects.length === 0 && <div className="px-4 py-6 text-sm text-ink-600">No projects yet.</div>}
            {desktop
              ? (recentProjects as ProjectFull[]).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => navigate(`/projects/${p.id}`)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface-300/60 transition-colors"
                  >
                    <div>
                      <div className="text-sm font-medium text-ink-100">{p.name}</div>
                      <div className="flex items-center gap-1.5 mt-1">
                        {(p.tech_stack || '').split(',').map((t) => t.trim()).filter(Boolean).map((t) => (
                          <span key={t} className="text-[10px] font-medium text-ink-400 bg-surface-300 border border-surface-500 rounded px-1.5 py-0.5">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                    <StatusBadge status={p.status || 'Planning'} />
                  </button>
                ))
              : (recentProjects as typeof legacyProjects).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => navigate(`/projects/${p.id}`)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface-300/60 transition-colors"
                  >
                    <div>
                      <div className="text-sm font-medium text-ink-100">{p.name}</div>
                      <div className="flex items-center gap-1.5 mt-1">
                        {p.technology.map((t) => (
                          <span key={t} className="text-[10px] font-medium text-ink-400 bg-surface-300 border border-surface-500 rounded px-1.5 py-0.5">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                    <StatusBadge status={p.status} />
                  </button>
                ))}
          </div>
        </div>

        <div className="rounded-xl border border-surface-400 bg-surface-200 shadow-soft">
          <div className="flex items-center justify-between px-4 py-3 border-b border-surface-400">
            <h2 className="text-sm font-semibold text-ink-100">Recent Invoices</h2>
            <button onClick={() => navigate('/invoices')} className="text-xs text-accent-400 hover:text-accent-300 inline-flex items-center gap-0.5">
              View All <ChevronRight size={13} />
            </button>
          </div>
          <div className="divide-y divide-surface-400">
            {recentInvoices.length === 0 && <div className="px-4 py-6 text-sm text-ink-600">No invoices yet.</div>}
            {desktop
              ? (recentInvoices as DbInvoice[]).map((inv) => (
                  <button
                    key={inv.id}
                    onClick={() => navigate(`/invoices/${inv.id}`)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface-300/60 transition-colors"
                  >
                    <div>
                      <div className="text-sm font-medium text-ink-100">{inv.invoice_number}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-ink-100 tabular-nums">{formatINR(inv.total)}</div>
                      <div className="mt-1"><StatusBadge status={inv.status} /></div>
                    </div>
                  </button>
                ))
              : (recentInvoices as typeof legacyInvoices).map((inv) => (
                  <button
                    key={inv.id}
                    onClick={() => navigate(`/invoices/${inv.id}`)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface-300/60 transition-colors"
                  >
                    <div>
                      <div className="text-sm font-medium text-ink-100">{inv.invoiceNumber}</div>
                      <div className="text-xs text-ink-500 mt-0.5">{inv.billTo.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-ink-100 tabular-nums">{formatINR(computeInvoiceTotals(inv).grandTotal)}</div>
                      <div className="mt-1"><StatusBadge status={inv.status} /></div>
                    </div>
                  </button>
                ))}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-surface-400 bg-surface-200 shadow-soft p-4">
        <h2 className="text-sm font-semibold text-ink-100 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {quickActions.map((qa) => (
            <button
              key={qa.label}
              onClick={qa.action}
              className="flex items-center gap-2.5 rounded-lg border border-surface-500 bg-surface-300 px-3 py-2.5 text-sm text-ink-200 hover:bg-surface-400 hover:text-ink-100 transition-colors"
            >
              <qa.icon size={15} className="text-accent-400" />
              {qa.label}
            </button>
          ))}
        </div>
      </div>

      <Modal open={!!comingSoon} onClose={() => setComingSoon(null)} title={comingSoon ?? ''} size="sm">
        <p className="text-sm text-ink-300">{comingSoon} is coming in a future phase. For now this section is a UI placeholder only.</p>
      </Modal>

      <AddSecretModal open={showAddSecret} onClose={() => setShowAddSecret(false)} projectId={null} onSaved={() => setShowAddSecret(false)} />
      <AddPasswordModal open={showAddPassword} onClose={() => setShowAddPassword(false)} projectId={null} onSaved={() => setShowAddPassword(false)} />
      <ImportEnvModal open={showImportEnv} onClose={() => setShowImportEnv(false)} projectId={null} onImported={() => setShowImportEnv(false)} />
      <AddDatabaseModal open={showAddDatabase} onClose={() => setShowAddDatabase(false)} projectId={null} onSaved={() => setShowAddDatabase(false)} />
    </div>
  )
}
