import React from 'react'
import { ProfileForm } from '@/components/profile/ProfileForm'
import { useProfile } from '@/auth/ProfileContext'

// Shown once, right after first sign-in, when the owner profile hasn't been
// completed yet (profile_completed_at is null). Blocks the rest of the app
// until the required fields are saved — see App.tsx's ProtectedRoute.
export default function ProfileSetup() {
  const { profile, refresh } = useProfile()

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-surface-100 px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-surface-500 bg-surface-200 p-8 shadow-soft">
        <h1 className="text-xl font-semibold text-ink-100">Set up your studio</h1>
        <p className="mt-1 text-sm text-ink-400">
          A few details before you get started — you can change any of this later from Settings.
        </p>

        <div className="mt-6">
          <ProfileForm
            initial={profile}
            requireAll
            submitLabel="Finish setup"
            onSaved={() => refresh()}
          />
        </div>
      </div>
    </div>
  )
}
