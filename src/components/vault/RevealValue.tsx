import React, { useEffect, useRef, useState } from 'react'
import { Eye, EyeOff, Copy } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { copySecurely } from '@/vault/VaultContext'

const AUTO_HIDE_MS = 30_000

interface RevealValueProps {
  onReveal: () => Promise<string>
  masked?: string
  monospace?: boolean
}

/** Masked-by-default value with Reveal (auto-hides after 30s) and Copy actions. */
export function RevealValue({ onReveal, masked = '••••••••••••••••', monospace = true }: RevealValueProps) {
  const [value, setValue] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const { show } = useToast()
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [])

  async function reveal() {
    if (value !== null) {
      setValue(null)
      if (timerRef.current) window.clearTimeout(timerRef.current)
      return
    }
    setBusy(true)
    try {
      const v = await onReveal()
      setValue(v)
      if (timerRef.current) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => setValue(null), AUTO_HIDE_MS)
    } catch (e) {
      show(String(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function copy() {
    try {
      const v = value ?? (await onReveal())
      await copySecurely(v)
      show('Copied securely')
    } catch (e) {
      show(String(e), 'error')
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className={`text-ink-300 ${monospace ? 'font-mono' : ''} ${value ? 'tracking-normal' : 'tracking-widest'} select-none max-w-[220px] truncate`}>
        {value ?? masked}
      </span>
      <button onClick={reveal} disabled={busy} title={value ? 'Hide' : 'Reveal'} className="text-ink-500 hover:text-ink-100 transition-colors">
        {value ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
      <button onClick={copy} title="Copy" className="text-ink-500 hover:text-ink-100 transition-colors">
        <Copy size={14} />
      </button>
    </div>
  )
}
