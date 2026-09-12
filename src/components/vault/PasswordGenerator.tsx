import React, { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { generatePassword, DEFAULT_GENERATOR_OPTIONS, PasswordGeneratorOptions } from '@/vault/passwordGenerator'

export function PasswordGeneratorPanel({ onUse }: { onUse: (value: string) => void }) {
  const [opts, setOpts] = useState<PasswordGeneratorOptions>(DEFAULT_GENERATOR_OPTIONS)
  const [preview, setPreview] = useState(() => generatePassword(DEFAULT_GENERATOR_OPTIONS))

  function regen(next: PasswordGeneratorOptions = opts) {
    setOpts(next)
    setPreview(generatePassword(next))
  }

  return (
    <div className="rounded-lg border border-surface-500 bg-surface-300 p-3.5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <code className="flex-1 text-xs font-mono text-ink-100 bg-surface-400 rounded px-2.5 py-2 truncate">{preview}</code>
        <button type="button" onClick={() => regen()} className="grid place-items-center h-8 w-8 rounded-md text-ink-400 hover:text-ink-100 hover:bg-surface-400 transition-colors shrink-0">
          <RefreshCw size={14} />
        </button>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-ink-400">Length</span>
          <span className="text-xs text-ink-300 tabular-nums">{opts.length}</span>
        </div>
        <input
          type="range"
          min={8}
          max={48}
          value={opts.length}
          onChange={(e) => regen({ ...opts, length: Number(e.target.value) })}
          className="w-full accent-accent-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <Toggle label="Uppercase" checked={opts.uppercase} onChange={(v) => regen({ ...opts, uppercase: v })} />
        <Toggle label="Lowercase" checked={opts.lowercase} onChange={(v) => regen({ ...opts, lowercase: v })} />
        <Toggle label="Numbers" checked={opts.numbers} onChange={(v) => regen({ ...opts, numbers: v })} />
        <Toggle label="Symbols" checked={opts.symbols} onChange={(v) => regen({ ...opts, symbols: v })} />
      </div>

      <button
        type="button"
        onClick={() => onUse(preview)}
        className="w-full rounded-lg bg-accent-500 text-white text-sm font-medium py-2 hover:bg-accent-600 transition-colors"
      >
        Use This Password
      </button>
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-ink-300 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-accent-500" />
      {label}
    </label>
  )
}
