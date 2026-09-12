import React, { createContext, useCallback, useContext, useState } from 'react'
import { CheckCircle2, XCircle, Info, X } from 'lucide-react'

type ToastKind = 'success' | 'error' | 'info'
interface Toast {
  id: string
  message: string
  kind: ToastKind
}

interface ToastContextValue {
  show: (message: string, kind?: ToastKind) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const show = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = Math.random().toString(36).slice(2)
    setToasts((t) => [...t, { id, message, kind }])
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id))
    }, 3200)
  }, [])

  const dismiss = (id: string) => setToasts((t) => t.filter((x) => x.id !== id))

  const icon = { success: CheckCircle2, error: XCircle, info: Info }
  const color = {
    success: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    error: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
    info: 'text-accent-400 border-accent-500/30 bg-accent-500/10',
  }

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 no-print">
        {toasts.map((t) => {
          const Icon = icon[t.kind]
          return (
            <div
              key={t.id}
              className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm shadow-panel backdrop-blur-md ${color[t.kind]} bg-surface-200/95 animate-[fadeIn_.15s_ease-out]`}
            >
              <Icon size={16} className="shrink-0" />
              <span className="text-ink-100">{t.message}</span>
              <button onClick={() => dismiss(t.id)} className="ml-2 text-ink-500 hover:text-ink-100">
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
