import React, { useState } from 'react'
import { Download, ChevronDown, ClipboardCopy, ListOrdered } from 'lucide-react'
import { vaultApi } from '@/vault/tauriClient'
import { useToast } from '@/hooks/useToast'
import { copySecurely } from '@/vault/VaultContext'

export function ExportEnvMenu({ projectId, fileNameHint }: { projectId: string | null; fileNameHint: string }) {
  const [open, setOpen] = useState(false)
  const { show } = useToast()

  async function getPairs(): Promise<[string, string][]> {
    return vaultApi.secretsExport(projectId)
  }

  async function copyEnv() {
    setOpen(false)
    try {
      const pairs = await getPairs()
      const text = pairs.map(([k, v]) => `${k}=${v}`).join('\n')
      await copySecurely(text)
      show('Copied securely')
    } catch (e) {
      show(String(e), 'error')
    }
  }

  async function copyNamesOnly() {
    setOpen(false)
    try {
      const pairs = await getPairs()
      const text = pairs.map(([k]) => k).join('\n')
      await navigator.clipboard.writeText(text)
      show('Copied variable names')
    } catch (e) {
      show(String(e), 'error')
    }
  }

  async function downloadEnv() {
    setOpen(false)
    try {
      const pairs = await getPairs()
      const text = pairs.map(([k, v]) => `${k}=${v}`).join('\n') + '\n'
      const blob = new Blob([text], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${fileNameHint || 'nexforge'}.env`
      a.click()
      URL.revokeObjectURL(url)
      show('Downloaded .env')
    } catch (e) {
      show(String(e), 'error')
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-surface-500 bg-surface-300 px-3 py-2 text-sm text-ink-100 hover:bg-surface-400 transition-colors"
      >
        <Download size={14} /> Export / Copy <ChevronDown size={13} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1.5 w-56 rounded-lg border border-surface-400 bg-surface-200 shadow-panel z-20 overflow-hidden">
            <MenuItem icon={ClipboardCopy} label="Copy .env" onClick={copyEnv} />
            <MenuItem icon={ListOrdered} label="Copy Names Only" onClick={copyNamesOnly} />
            <MenuItem icon={Download} label="Download .env" onClick={downloadEnv} />
          </div>
        </>
      )}
    </div>
  )
}

function MenuItem({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-ink-200 hover:bg-surface-300 transition-colors text-left">
      <Icon size={14} className="text-ink-500" /> {label}
    </button>
  )
}
