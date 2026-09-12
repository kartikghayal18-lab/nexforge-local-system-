import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Input } from '@/components/common/Input'
import { Button } from '@/components/common/Button'
import { useAuth } from '@/auth/AuthContext'

export default function Login() {
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const from = (location.state as { from?: string } | null)?.from || '/'

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (mode === 'login') await login(email, password)
      else await register(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-surface-100 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-surface-500 bg-surface-200 p-8 shadow-soft">
        <h1 className="text-xl font-semibold text-ink-100">Nexforge Studio Manager</h1>
        <p className="mt-1 text-sm text-ink-400">
          {mode === 'login' ? 'Sign in to your studio.' : 'Create the owner account for this studio.'}
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <Input
            label="Email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Password"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />

          {error && <p className="text-sm text-rose-400">{error}</p>}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </Button>
        </form>

        <button
          type="button"
          className="mt-4 text-xs text-ink-400 hover:text-ink-100"
          onClick={() => {
            setError(null)
            setMode(mode === 'login' ? 'register' : 'login')
          }}
        >
          {mode === 'login'
            ? 'First time setting this up? Create the owner account.'
            : 'Already have an account? Sign in.'}
        </button>
      </div>
    </div>
  )
}
