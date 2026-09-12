import React from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  FolderKanban,
  KeyRound,
  Lock,
  FileText,
  Users,
  StickyNote,
  FolderOpen,
  Settings,
  Boxes,
} from 'lucide-react'

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/secrets', label: 'Secrets & Keys', icon: KeyRound },
  { to: '/passwords', label: 'Passwords', icon: Lock },
  { to: '/invoices', label: 'Invoices', icon: FileText },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/notes', label: 'Notes', icon: StickyNote },
  { to: '/files', label: 'Files', icon: FolderOpen },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  return (
    <aside className="hidden md:flex w-[220px] shrink-0 flex-col border-r border-surface-400 bg-surface-100 no-print">
      <div className="flex items-center gap-2 px-4 h-14 border-b border-surface-400">
        <div className="grid place-items-center h-7 w-7 rounded-lg bg-accent-500 text-white">
          <Boxes size={15} />
        </div>
        <div className="leading-tight">
          <div className="text-[13px] font-semibold text-ink-100 tracking-tight">NEXFORGE</div>
          <div className="text-[10px] text-ink-500 tracking-wider -mt-0.5">STUDIOS</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin px-2.5 py-3 space-y-0.5">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors ${
                isActive
                  ? 'bg-accent-500/15 text-accent-400'
                  : 'text-ink-400 hover:text-ink-100 hover:bg-surface-300'
              }`
            }
          >
            <item.icon size={16} strokeWidth={2} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-surface-400 px-3 py-3 flex items-center gap-2.5">
        <div className="grid place-items-center h-8 w-8 rounded-full bg-accent-500/20 text-accent-400 text-xs font-semibold">
          P
        </div>
        <div className="leading-tight">
          <div className="text-[13px] font-medium text-ink-100">Prathamesh</div>
          <div className="text-[11px] text-ink-500">Owner</div>
        </div>
      </div>
    </aside>
  )
}
