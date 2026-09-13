import React, { useMemo, useState } from 'react'
import { Modal } from '@/components/common/Modal'
import { Button } from '@/components/common/Button'
import { Select } from '@/components/common/Input'
import { vaultApi } from '@/vault/tauriClient'
import { useToast } from '@/hooks/useToast'
import { VAULT_ENVIRONMENTS } from '@/vault/types'
import { guessCategoryForKey } from '@/vault/envPresets'
import { useProjectPicker } from './useProjectPicker'
import { useNavigate } from 'react-router-dom'

interface ParsedVar {
  key: string
  value: string
}

interface Props {
  open: boolean
  onClose: () => void
  projectId: string | null
  onImported: () => void
}

/** Parses .env-style text: KEY=value, ignores blank lines and # comments,
 * supports double- and single-quoted values. Never logs parsed values. */
export function parseEnvText(text: string): ParsedVar[] {
  const out: ParsedVar[] = []
  const lines = text.split(/\r?\n/)
  for (const raw of lines) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim().replace(/^export\s+/, '')
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith('“') && value.endsWith('”')) ||
      (value.startsWith('‘') && value.endsWith('’'))
    ) {
      value = value.slice(1, -1)
    }
    if (!key || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue
    out.push({ key: key.toUpperCase(), value })
  }
  return out
}

export function ImportEnvModal({ open, onClose, projectId, onImported }: Props) {
  const { show } = useToast()
  const navigate = useNavigate()
  const picker = useProjectPicker(projectId)
  const [text, setText] = useState('')
  const [environment, setEnvironment] = useState('Production')
  const [busy, setBusy] = useState(false)

  const parsed = useMemo(() => parseEnvText(text), [text])

  async function importVars() {
    if (parsed.length === 0) return
    if (!picker.canSubmit) {
      show('Choose a project first', 'error')
      return
    }
    setBusy(true)
    try {
      await vaultApi.secretsBulkCreate(
        parsed.map((p) => ({
          project_id: picker.resolvedProjectId,
          name: p.key,
          category: guessCategoryForKey(p.key),
          environment,
          value: p.value,
          notes: null,
        })),
      )
      show(`${parsed.length} variable${parsed.length === 1 ? '' : 's'} imported`)
      setText('')
      onImported()
      onClose()
    } catch (err) {
      show(String(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Import .env Variables" size="lg">
      <div className="space-y-3">
        {picker.needsPicker && (
          picker.noProjects ? (
            <p className="text-xs text-amber-400">
              You need a project first. <button type="button" onClick={() => navigate('/projects?new=1')} className="underline hover:text-amber-300">Create a project</button>
            </p>
          ) : (
            <Select label="Project" required value={picker.selected} onChange={(e) => picker.setSelected(e.target.value)}>
              <option value="">Select a project…</option>
              {picker.projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          )
        )}
        <Select label="Import into environment" value={environment} onChange={(e) => setEnvironment(e.target.value)}>
          {VAULT_ENVIRONMENTS.map((env) => (
            <option key={env} value={env}>{env}</option>
          ))}
        </Select>

        <div>
          <span className="block text-xs font-medium text-ink-400 mb-1">Paste .env contents</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            spellCheck={false}
            placeholder={'DATABASE_URL=postgresql://...\nSUPABASE_URL=https://...\nSUPABASE_ANON_KEY=...'}
            className="w-full rounded-lg border border-surface-500 bg-surface-300 px-3 py-2 text-xs font-mono text-ink-100 placeholder:text-ink-600 outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/40"
          />
        </div>

        {text.trim() && (
          <div className="rounded-lg border border-surface-500 bg-surface-300 px-3.5 py-3">
            <p className="text-xs font-medium text-ink-300 mb-2">
              {parsed.length} variable{parsed.length === 1 ? '' : 's'} detected
            </p>
            {parsed.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {parsed.map((p) => (
                  <span key={p.key} className="text-[11px] font-mono rounded bg-surface-400 border border-surface-500 px-1.5 py-0.5 text-ink-300">
                    {p.key}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-lg border border-surface-500 bg-surface-300 px-3.5 py-2 text-sm text-ink-100 hover:bg-surface-400 transition-colors">
            Cancel
          </button>
          <Button onClick={importVars} disabled={busy || parsed.length === 0 || !picker.canSubmit}>
            {busy ? 'Importing…' : `Import ${parsed.length || ''} Variable${parsed.length === 1 ? '' : 's'}`}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
