import React, { useEffect, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  FolderKanban,
  KeyRound,
  Lock,
  FileText,
  Users,
  StickyNote,
  FolderOpen,
  Settings as SettingsIcon,
  Boxes,
  ChevronsUpDown,
  UserCog,
  LogOut,
} from 'lucide-react'
import { Modal } from '@/components/common/Modal'
import { ProfileForm } from '@/components/profile/ProfileForm'
import { useAuth, API_BASE_URL } from '@/auth/AuthContext'
import { useProfile } from '@/auth/ProfileContext'

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/secrets', label: 'Secrets & Keys', icon: KeyRound },
  { to: '/passwords', label: 'Passwords', icon: Lock },
  { to: '/invoices', label: 'Invoices', icon: FileText },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/notes', label: 'Notes', icon: StickyNote },
  { to: '/files', label: 'Files', icon: FolderOpen },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
]

function avatarSrc(url: string | null | undefined): string {
  if (!url) return '/avatar-placeholder.svg'
  return url.startsWith('http') || url.startsWith('/avatar-placeholder') ? url : `${API_BASE_URL}${url}`
}

export function Sidebar() {
  const { logout } = useAuth()
  const { profile, loading, refresh } = useProfile()
  const navigate = useNavigate()

  const [menuOpen, setMenuOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    if (menuOpen) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [menuOpen])

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

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

      <div ref={menuRef} className="relative border-t border-surface-400 px-3 py-3">
        {loading ? (
          <div className="flex items-center gap-2.5 animate-pulse">
            <div className="h-8 w-8 rounded-full bg-surface-300" />
            <div className="flex-1 space-y-1.5">
              <div className="h-2.5 w-20 rounded bg-surface-300" />
              <div className="h-2 w-12 rounded bg-surface-300" />
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2.5 w-full text-left rounded-lg hover:bg-surface-300 -mx-1 px-1 py-1 transition-colors"
          >
            <img src={avatarSrc(profile?.avatar_url)} alt="" className="h-8 w-8 rounded-full object-cover border border-surface-400 bg-surface-300 shrink-0" />
            <div className="leading-tight min-w-0 flex-1">
              <div className="text-[13px] font-medium text-ink-100 truncate">{profile?.full_name || 'Set up profile'}</div>
              <div className="text-[11px] text-ink-500 truncate">{profile?.business_name || 'Owner'}</div>
            </div>
            <ChevronsUpDown size={14} className="text-ink-500 shrink-0" />
          </button>
        )}

        {menuOpen && (
          <div className="absolute bottom-full left-3 right-3 mb-1.5 rounded-lg border border-surface-500 bg-surface-200 shadow-panel py-1 z-20">
            <button
              onClick={() => {
                setMenuOpen(false)
                setEditOpen(true)
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-ink-200 hover:bg-surface-300 transition-colors"
            >
              <UserCog size={14} /> Edit Owner Profile
            </button>
            <button
              onClick={() => {
                setMenuOpen(false)
                navigate('/settings')
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-ink-200 hover:bg-surface-300 transition-colors"
            >
              <SettingsIcon size={14} /> Settings
            </button>
            <div className="my-1 border-t border-surface-400" />
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-rose-400 hover:bg-surface-300 transition-colors"
            >
              <LogOut size={14} /> Logout
            </button>
          </div>
        )}
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Owner Profile" size="lg">
        <ProfileForm
          initial={profile}
          submitLabel="Save changes"
          onCancel={() => setEditOpen(false)}
          onSaved={async () => {
            await refresh()
            setEditOpen(false)
          }}
        />
      </Modal>
    </aside>
  )
}
