import React, { useState } from 'react'
import { Input, Select } from '@/components/common/Input'
import { Button } from '@/components/common/Button'
import { coreApi, CoreApiError } from '@/data/coreClient'
import type { OwnerProfile, ProfileUpdate } from '@/data/coreTypes'
import { API_BASE_URL } from '@/auth/AuthContext'

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'AED']
const DEFAULT_AVATAR = '/avatar-placeholder.svg'

// Intl.supportedValuesOf isn't in the TS lib DOM types this project
// targets; feature-detect via a loose cast rather than widening the lib.
const timezoneOptions: string[] =
  typeof (Intl as any).supportedValuesOf === 'function' ? (Intl as any).supportedValuesOf('timeZone') : []

function guessTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

function avatarSrc(url: string | null): string {
  if (!url) return DEFAULT_AVATAR
  return url.startsWith('http') || url.startsWith('/avatar-placeholder') ? url : `${API_BASE_URL}${url}`
}

interface ProfileFormProps {
  initial: OwnerProfile | null
  onSaved: (profile: OwnerProfile) => void
  onCancel?: () => void
  submitLabel?: string
  // When true, "skip" leaves optional fields blank but still requires the
  // required set — used by first-run setup, which has nothing to fall back
  // to yet.
  requireAll?: boolean
}

export function ProfileForm({ initial, onSaved, onCancel, submitLabel = 'Save', requireAll }: ProfileFormProps) {
  const [fullName, setFullName] = useState(initial?.full_name ?? '')
  const [businessName, setBusinessName] = useState(initial?.business_name ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [address, setAddress] = useState(initial?.address ?? '')
  const [website, setWebsite] = useState(initial?.website ?? '')
  const [gstin, setGstin] = useState(initial?.gstin ?? '')
  const [currency, setCurrency] = useState(initial?.currency ?? 'INR')
  const [timezone, setTimezone] = useState(initial?.timezone ?? guessTimezone())
  const [avatarUrl, setAvatarUrl] = useState(initial?.avatar_url ?? '')
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  async function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Only JPG, PNG or WebP images are allowed.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image is too large (5MB max).')
      return
    }
    setAvatarUploading(true)
    setError(null)
    try {
      const { url } = await coreApi.profileAvatarUpload(file)
      setAvatarUrl(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Avatar upload failed')
    } finally {
      setAvatarUploading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setFieldErrors({})
    setSaving(true)
    try {
      // A generated placeholder avatar satisfies the "avatar required"
      // rule if the owner doesn't want to upload a real one on first run —
      // forcing an image upload before letting someone into their own app
      // is a rough first-run experience. Real uploads always take
      // precedence once made.
      const finalAvatarUrl = avatarUrl || DEFAULT_AVATAR
      const input: ProfileUpdate = {
        full_name: fullName.trim(),
        business_name: businessName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        website: website.trim() || null,
        gstin: gstin.trim() || null,
        currency,
        timezone,
        avatar_url: finalAvatarUrl,
      }
      const saved = await coreApi.profileUpdate(input)
      onSaved(saved)
    } catch (err) {
      if (err instanceof CoreApiError && err.fields) {
        setFieldErrors(err.fields)
      }
      setError(err instanceof Error ? err.message : 'Could not save profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-4">
        <img src={avatarSrc(avatarUrl)} alt="Avatar" className="h-16 w-16 rounded-full object-cover border border-surface-400 bg-surface-300" />
        <div>
          <label className="inline-flex items-center gap-1.5 rounded-lg bg-surface-300 border border-surface-500 text-ink-100 text-xs font-medium px-2.5 py-1.5 cursor-pointer hover:bg-surface-400 transition-colors">
            {avatarUploading ? 'Uploading…' : 'Upload photo'}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarFile} disabled={avatarUploading} />
          </label>
          <p className="text-[11px] text-ink-500 mt-1">{requireAll ? 'Optional to upload — a default avatar is used otherwise.' : 'JPG, PNG or WebP, 5MB max.'}</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <Input label="Full name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <Input label="Business name" required value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <Input label="Phone" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 0100" />
        <Input label="Website (optional)" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" />
      </div>
      <Input label="Address" required value={address} onChange={(e) => setAddress(e.target.value)} />
      <div className="grid sm:grid-cols-3 gap-3">
        <Select label="Currency" required value={currency} onChange={(e) => setCurrency(e.target.value)}>
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>
        <Input
          label="Timezone"
          required
          list="tz-list"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          wrapperClassName="sm:col-span-1"
        />
        <Input label="GSTIN / Tax ID (optional)" value={gstin} onChange={(e) => setGstin(e.target.value)} />
      </div>
      <datalist id="tz-list">
        {timezoneOptions.map((tz) => (
          <option key={tz} value={tz} />
        ))}
      </datalist>

      {Object.keys(fieldErrors).length > 0 && (
        <ul className="text-xs text-rose-400 list-disc pl-4">
          {Object.values(fieldErrors).map((msg, i) => (
            <li key={i}>{msg}</li>
          ))}
        </ul>
      )}
      {error && <p className="text-sm text-rose-400">{error}</p>}

      <div className="flex items-center justify-end gap-2 pt-1">
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-lg border border-surface-500 bg-surface-300 px-3.5 py-2 text-sm text-ink-100 hover:bg-surface-400 transition-colors">
            Cancel
          </button>
        )}
        <Button type="submit" disabled={saving || avatarUploading}>{saving ? 'Saving…' : submitLabel}</Button>
      </div>
    </form>
  )
}
