import React, { useEffect, useState } from 'react'
import { Building2, FileText, Percent, Wallet, Palette, ShieldCheck, UserCog, AlertTriangle } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/common/Button'
import { Input, Select } from '@/components/common/Input'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { useToast } from '@/hooks/useToast'
import { NEXFORGE_PROFILE, DEFAULT_PAYMENT_DETAILS } from '@/data/seed'
import { SecuritySettings } from '@/components/vault/SecuritySettings'
import { coreApi, isDesktop } from '@/data/coreClient'
import { useAuth, API_BASE_URL } from '@/auth/AuthContext'
import { useProfile } from '@/auth/ProfileContext'
import { ProfileForm } from '@/components/profile/ProfileForm'
import { Modal } from '@/components/common/Modal'
import { useNavigate } from 'react-router-dom'

const tabs = [
  { id: 'profile', label: 'Owner Profile', icon: UserCog },
  { id: 'company', label: 'Company Profile', icon: Building2 },
  { id: 'invoice', label: 'Invoice Settings', icon: FileText },
  { id: 'tax', label: 'Tax Settings', icon: Percent },
  { id: 'payment', label: 'Payment Details', icon: Wallet },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'backup', label: 'Backup & Security', icon: ShieldCheck },
  { id: 'danger', label: 'Danger Zone', icon: AlertTriangle },
] as const

type TabId = (typeof tabs)[number]['id']

// Business-profile settings keys stored in the SQLite `settings` table via
// settings_get_all / settings_set_many (desktop mode only). Everything else
// on this page (payment bank details, appearance, backup) stays on
// localStorage / the vault, since those aren't part of the `settings`
// business-profile scope yet.
interface BizProfile {
  business_name: string
  business_email: string
  business_phone: string
  business_address: string
  business_website: string
  business_gstin: string
  invoice_prefix: string
  currency: string
  default_tax_rate: string
  payment_terms: string
  footer_text: string
  business_logo_base64: string
}

const BIZ_DEFAULTS: BizProfile = {
  business_name: NEXFORGE_PROFILE.name,
  business_email: NEXFORGE_PROFILE.email,
  business_phone: NEXFORGE_PROFILE.phone,
  business_address: NEXFORGE_PROFILE.address,
  business_website: NEXFORGE_PROFILE.website,
  business_gstin: NEXFORGE_PROFILE.gstin,
  invoice_prefix: 'NF',
  currency: 'INR',
  default_tax_rate: '18',
  payment_terms: 'Net 14 Days',
  footer_text: 'Thank you for your business.',
  business_logo_base64: '',
}

function friendlyError(e: unknown): string {
  console.error(e)
  return 'Could not load or save settings. Please try again.'
}

export default function Settings() {
  const desktop = isDesktop()
  const [tab, setTab] = useState<TabId>('company')
  const { show } = useToast()
  const { logout } = useAuth()
  const { profile, refresh: refreshProfile } = useProfile()
  const navigate = useNavigate()

  // ---- Workspace reset ----
  const [resetModalOpen, setResetModalOpen] = useState(false)
  const [resetConfirmText, setResetConfirmText] = useState('')
  const [resetting, setResetting] = useState(false)

  async function handleResetWorkspace() {
    setResetting(true)
    try {
      await coreApi.workspaceReset()
      show('Workspace data reset')
      setResetModalOpen(false)
      setResetConfirmText('')
      navigate('/', { replace: true })
      window.location.reload()
    } catch (e) {
      show(friendlyError(e), 'error')
    } finally {
      setResetting(false)
    }
  }

  // ---- Account deletion ----
  const [deleteStep, setDeleteStep] = useState<'idle' | 'code-sent'>('idle')
  const [deleteCode, setDeleteCode] = useState('')
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [sendingDeleteCode, setSendingDeleteCode] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleSendDeleteCode() {
    if (!profile?.email) return
    setSendingDeleteCode(true)
    setDeleteError(null)
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: profile.email }),
      })
      if (!res.ok) throw new Error('Could not send verification code')
      setDeleteStep('code-sent')
      show('Verification code sent to your email')
    } catch (e) {
      setDeleteError(friendlyError(e))
    } finally {
      setSendingDeleteCode(false)
    }
  }

  async function handleDeleteAccount() {
    setDeletingAccount(true)
    setDeleteError(null)
    try {
      await coreApi.accountDelete(deleteCode.trim())
      logout()
      navigate('/login', { replace: true })
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Could not delete account')
    } finally {
      setDeletingAccount(false)
    }
  }

  // ---- Legacy localStorage-backed state (browser-mode fallback) ----
  const [company, setCompany] = useLocalStorage('settings:company', NEXFORGE_PROFILE)
  const [invoiceSettings, setInvoiceSettings] = useLocalStorage('settings:invoice', {
    prefix: 'NF',
    startingNumber: 1,
    defaultTerms: 'Net 14 Days',
    footerNote: 'Thank you for your business.',
  })
  const [taxSettings, setTaxSettings] = useLocalStorage('settings:tax', {
    defaultGstMode: 'CGST_SGST' as 'CGST_SGST' | 'IGST',
    defaultGstPercentage: 18,
  })
  const [payment, setPayment] = useLocalStorage('settings:payment', DEFAULT_PAYMENT_DETAILS)

  // ---- Desktop-backed business profile ----
  const [biz, setBiz] = useState<BizProfile>(BIZ_DEFAULTS)
  const [loading, setLoading] = useState(desktop)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!desktop) return
    ;(async () => {
      setLoading(true)
      try {
        const raw = await coreApi.settingsGetAll()
        setBiz({ ...BIZ_DEFAULTS, ...raw } as BizProfile)
      } catch (e) {
        show(friendlyError(e), 'error')
      } finally {
        setLoading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desktop])

  function patchBiz(p: Partial<BizProfile>) {
    setBiz((prev) => ({ ...prev, ...p }))
  }

  async function save() {
    if (desktop) {
      setSaving(true)
      try {
        await coreApi.settingsSetMany(biz as unknown as Record<string, string>)
        show('Settings saved')
      } catch (e) {
        show(friendlyError(e), 'error')
      } finally {
        setSaving(false)
      }
    } else {
      show('Settings saved')
    }
  }

  return (
    <div>
      <PageHeader title="Settings" subtitle="Configure Nexforge Studios defaults." />

      {!desktop && (
        <div className="mb-4 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-400">
          Demo data — open this app in Desktop Mode to save your business profile permanently.
        </div>
      )}

      <div className="grid md:grid-cols-[200px_1fr] gap-5">
        <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium shrink-0 transition-colors ${
                tab === t.id ? 'bg-accent-500/15 text-accent-400' : 'text-ink-400 hover:text-ink-100 hover:bg-surface-300'
              }`}
            >
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </nav>

        <div className="rounded-xl border border-surface-400 bg-surface-200 p-5">
          {tab === 'profile' && (
            <div className="max-w-lg">
              <ProfileForm
                initial={profile}
                submitLabel="Save changes"
                onSaved={async () => {
                  await refreshProfile()
                  show('Profile updated')
                }}
              />
            </div>
          )}

          {tab === 'danger' && (
            <div className="max-w-lg space-y-6">
              <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-4">
                <h3 className="text-sm font-semibold text-ink-100 mb-1">Reset Workspace Data</h3>
                <p className="text-xs text-ink-400 mb-3">
                  Permanently deletes all clients, projects, invoices, payments, vault entries and files.
                  Your owner account and profile are not affected.
                </p>
                <Button variant="secondary" size="sm" onClick={() => setResetModalOpen(true)}>Reset Workspace Data</Button>
              </div>

              <div className="rounded-lg border border-rose-500/25 bg-rose-500/5 p-4">
                <h3 className="text-sm font-semibold text-ink-100 mb-1">Delete Owner Account</h3>
                <p className="text-xs text-ink-400 mb-3">
                  Permanently deletes your owner account and all associated workspace data. This cannot be
                  undone, and there is no account left to sign back into.
                </p>

                {deleteStep === 'idle' && (
                  <Button variant="danger" size="sm" onClick={handleSendDeleteCode} disabled={sendingDeleteCode}>
                    {sendingDeleteCode ? 'Sending code…' : 'Start account deletion'}
                  </Button>
                )}

                {deleteStep === 'code-sent' && (
                  <div className="space-y-3">
                    <Input
                      label="Verification code (sent to your email)"
                      value={deleteCode}
                      onChange={(e) => setDeleteCode(e.target.value.replace(/\D/g, ''))}
                      maxLength={6}
                      placeholder="123456"
                    />
                    <Input
                      label='Type "DELETE" to confirm'
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder="DELETE"
                    />
                    {deleteError && <p className="text-sm text-rose-400">{deleteError}</p>}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={deleteConfirmText !== 'DELETE' || deleteCode.length !== 6 || deletingAccount}
                        onClick={handleDeleteAccount}
                      >
                        {deletingAccount ? 'Deleting…' : 'Permanently delete my account'}
                      </Button>
                      <button
                        type="button"
                        className="text-xs text-ink-400 hover:text-ink-100"
                        onClick={() => {
                          setDeleteStep('idle')
                          setDeleteCode('')
                          setDeleteConfirmText('')
                          setDeleteError(null)
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'company' && (
            desktop ? (
              loading ? (
                <div className="h-40 rounded-lg bg-surface-300 animate-pulse max-w-lg" />
              ) : (
                <div className="space-y-3 max-w-lg">
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="Business name" value={biz.business_name} onChange={(e) => patchBiz({ business_name: e.target.value })} />
                    <Input label="GSTIN / Tax ID" value={biz.business_gstin} onChange={(e) => patchBiz({ business_gstin: e.target.value })} />
                  </div>
                  <Input label="Address" value={biz.business_address} onChange={(e) => patchBiz({ business_address: e.target.value })} />
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="Phone" value={biz.business_phone} onChange={(e) => patchBiz({ business_phone: e.target.value })} />
                    <Input label="Email" value={biz.business_email} onChange={(e) => patchBiz({ business_email: e.target.value })} />
                  </div>
                  <Input label="Website" value={biz.business_website} onChange={(e) => patchBiz({ business_website: e.target.value })} />
                  <div>
                    <label className="block text-xs font-medium text-ink-400 mb-1.5">Business logo</label>
                    <div className="flex items-center gap-3">
                      {biz.business_logo_base64 ? (
                        <img src={`data:image/png;base64,${biz.business_logo_base64}`} alt="Business logo" className="h-12 w-12 rounded-lg object-contain border border-surface-400 bg-surface-100" />
                      ) : (
                        <div className="h-12 w-12 rounded-lg border border-dashed border-surface-400 flex items-center justify-center text-[10px] text-ink-500">No logo</div>
                      )}
                      <input
                        type="file"
                        accept="image/png,image/jpeg"
                        className="text-xs text-ink-400 file:mr-3 file:rounded-md file:border-0 file:bg-surface-300 file:px-3 file:py-1.5 file:text-xs file:text-ink-200 hover:file:bg-surface-400"
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          if (file.size > 1024 * 1024) {
                            show('Logo must be under 1MB', 'error')
                            return
                          }
                          const reader = new FileReader()
                          reader.onload = () => {
                            const result = reader.result as string
                            const base64 = result.split(',')[1] ?? ''
                            patchBiz({ business_logo_base64: base64 })
                          }
                          reader.readAsDataURL(file)
                        }}
                      />
                      {biz.business_logo_base64 && (
                        <Button size="sm" variant="secondary" onClick={() => patchBiz({ business_logo_base64: '' })}>Remove</Button>
                      )}
                    </div>
                  </div>
                </div>
              )
            ) : (
              <div className="space-y-3 max-w-lg">
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Business name" value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} />
                  <Input label="Tagline" value={company.tagline} onChange={(e) => setCompany({ ...company, tagline: e.target.value })} />
                </div>
                <Input label="Address" value={company.address} onChange={(e) => setCompany({ ...company, address: e.target.value })} />
                <div className="grid grid-cols-3 gap-3">
                  <Input label="City" value={company.city} onChange={(e) => setCompany({ ...company, city: e.target.value })} />
                  <Input label="State" value={company.state} onChange={(e) => setCompany({ ...company, state: e.target.value })} />
                  <Input label="PIN" value={company.pin} onChange={(e) => setCompany({ ...company, pin: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Phone" value={company.phone} onChange={(e) => setCompany({ ...company, phone: e.target.value })} />
                  <Input label="Email" value={company.email} onChange={(e) => setCompany({ ...company, email: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Website" value={company.website} onChange={(e) => setCompany({ ...company, website: e.target.value })} />
                  <Input label="GSTIN" value={company.gstin} onChange={(e) => setCompany({ ...company, gstin: e.target.value })} />
                </div>
              </div>
            )
          )}

          {tab === 'invoice' && (
            desktop ? (
              <div className="space-y-3 max-w-lg">
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Invoice number prefix" value={biz.invoice_prefix} onChange={(e) => patchBiz({ invoice_prefix: e.target.value })} />
                  <Input label="Currency" value={biz.currency} onChange={(e) => patchBiz({ currency: e.target.value })} />
                </div>
                <Input label="Default payment terms" value={biz.payment_terms} onChange={(e) => patchBiz({ payment_terms: e.target.value })} />
                <Input label="Default footer note" value={biz.footer_text} onChange={(e) => patchBiz({ footer_text: e.target.value })} />
              </div>
            ) : (
              <div className="space-y-3 max-w-lg">
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Invoice number prefix" value={invoiceSettings.prefix} onChange={(e) => setInvoiceSettings({ ...invoiceSettings, prefix: e.target.value })} />
                  <Input type="number" label="Starting number" value={invoiceSettings.startingNumber} onChange={(e) => setInvoiceSettings({ ...invoiceSettings, startingNumber: Number(e.target.value) })} />
                </div>
                <Input label="Default payment terms" value={invoiceSettings.defaultTerms} onChange={(e) => setInvoiceSettings({ ...invoiceSettings, defaultTerms: e.target.value })} />
                <Input label="Default footer note" value={invoiceSettings.footerNote} onChange={(e) => setInvoiceSettings({ ...invoiceSettings, footerNote: e.target.value })} />
              </div>
            )
          )}

          {tab === 'tax' && (
            desktop ? (
              <div className="space-y-3 max-w-lg">
                <Input type="number" label="Default Tax %" value={biz.default_tax_rate} onChange={(e) => patchBiz({ default_tax_rate: e.target.value })} />
                <p className="text-xs text-ink-500">Applied as the default tax rate when creating a new invoice.</p>
              </div>
            ) : (
              <div className="space-y-3 max-w-lg">
                <Select label="Default GST mode" value={taxSettings.defaultGstMode} onChange={(e) => setTaxSettings({ ...taxSettings, defaultGstMode: e.target.value as any })}>
                  <option value="CGST_SGST">CGST + SGST</option>
                  <option value="IGST">IGST</option>
                </Select>
                <Input type="number" label="Default GST %" value={taxSettings.defaultGstPercentage} onChange={(e) => setTaxSettings({ ...taxSettings, defaultGstPercentage: Number(e.target.value) })} />
              </div>
            )
          )}

          {tab === 'payment' && (
            <div className="space-y-3 max-w-lg">
              <Input label="Bank Name" value={payment.bankName} onChange={(e) => setPayment({ ...payment, bankName: e.target.value })} />
              <Input label="Account Name" value={payment.accountName} onChange={(e) => setPayment({ ...payment, accountName: e.target.value })} />
              <Input label="Account Number" value={payment.accountNumber} onChange={(e) => setPayment({ ...payment, accountNumber: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="IFSC Code" value={payment.ifsc} onChange={(e) => setPayment({ ...payment, ifsc: e.target.value })} />
                <Input label="UPI ID" value={payment.upi} onChange={(e) => setPayment({ ...payment, upi: e.target.value })} />
              </div>
              <p className="text-xs text-ink-500">Bank/UPI details are currently stored locally on this device only (not yet part of the synced business profile).</p>
            </div>
          )}

          {tab === 'appearance' && (
            <div className="max-w-lg space-y-3">
              <p className="text-sm text-ink-400">Nexforge Studio Manager currently ships in a dark, developer-focused theme. Light theme and accent customization are planned for a later phase.</p>
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-surface-300 border-2 border-accent-500" />
                <div className="h-9 w-9 rounded-lg bg-[#f5f6f8] border border-surface-500 opacity-40" />
              </div>
            </div>
          )}

          {tab === 'backup' && <SecuritySettings />}

          {tab !== 'appearance' && tab !== 'backup' && tab !== 'profile' && tab !== 'danger' && (
            <div className="flex justify-end pt-5 mt-5 border-t border-surface-400">
              <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</Button>
            </div>
          )}
        </div>
      </div>

      <Modal open={resetModalOpen} onClose={() => setResetModalOpen(false)} title="Reset Workspace Data">
        <div className="space-y-3">
          <p className="text-sm text-ink-300">
            This will permanently delete all workspace data. Your owner account and profile will remain.
          </p>
          <Input
            label='Type "RESET" to confirm'
            value={resetConfirmText}
            onChange={(e) => setResetConfirmText(e.target.value)}
            placeholder="RESET"
          />
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setResetModalOpen(false)
                setResetConfirmText('')
              }}
              className="rounded-lg border border-surface-500 bg-surface-300 px-3.5 py-2 text-sm text-ink-100 hover:bg-surface-400 transition-colors"
            >
              Cancel
            </button>
            <Button variant="danger" disabled={resetConfirmText !== 'RESET' || resetting} onClick={handleResetWorkspace}>
              {resetting ? 'Resetting…' : 'Reset Workspace Data'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
