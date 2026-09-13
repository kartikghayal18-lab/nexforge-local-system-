import React from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import Dashboard from '@/pages/Dashboard'
import Projects from '@/pages/Projects'
import ProjectDetails from '@/pages/ProjectDetails'
import ProjectVault from '@/pages/ProjectVault'
import Invoices from '@/pages/Invoices'
import InvoiceEditor from '@/pages/InvoiceEditor'
import InvoiceView from '@/pages/InvoiceView'
import Clients from '@/pages/Clients'
import Secrets from '@/pages/Secrets'
import Passwords from '@/pages/Passwords'
import Notes from '@/pages/Notes'
import Files from '@/pages/Files'
import Settings from '@/pages/Settings'
import Login from '@/pages/Login'
import ProfileSetup from '@/pages/ProfileSetup'
import NotFound from '@/pages/NotFound'
import { useAuth } from '@/auth/AuthContext'
import { ProfileProvider, useProfile } from '@/auth/ProfileContext'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-ink-400 text-sm">Loading…</div>
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  // ProfileProvider fetches live auth state's profile; gating below reads
  // it, so this reflects the current session on every render, not a stale
  // snapshot from before logout/login.
  return <ProfileProvider>{children}</ProfileProvider>
}

// Blocks navigation into the rest of the app until the owner profile's
// required fields are filled in (profile_completed_at is null) — required
// fields can't be skipped, but this only ever runs once per account.
function RequireCompleteProfile({ children }: { children: React.ReactNode }) {
  const { profile, loading, isComplete } = useProfile()

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-ink-400 text-sm">Loading…</div>
  }
  if (profile && !isComplete) {
    return <ProfileSetup />
  }
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <RequireCompleteProfile>
              <AppLayout />
            </RequireCompleteProfile>
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:id" element={<ProjectDetails />} />
        <Route path="/projects/:id/vault" element={<ProjectVault />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/invoices/new" element={<InvoiceEditor />} />
        <Route path="/invoices/:id" element={<InvoiceView />} />
        <Route path="/invoices/:id/edit" element={<InvoiceEditor />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/secrets" element={<Secrets />} />
        <Route path="/passwords" element={<Passwords />} />
        <Route path="/notes" element={<Notes />} />
        <Route path="/files" element={<Files />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
