import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Input } from '@/components/common/Input'
import { Button } from '@/components/common/Button'
import { useAuth, ApiError } from '@/auth/AuthContext'

type Step = 'email' | 'code'

export default function Login() {
  const { sendOtp, verifyOtp, login, register } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [verified, setVerified] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  // Fallback password flow — kept for the existing single-owner registration
  // path and as a backup if email delivery isn't set up yet. Not the default
  // UI; toggled into via the link at the bottom, same components/styles.
  const [usePassword, setUsePassword] = useState(false)
  const [pwMode, setPwMode] = useState<'login' | 'register'>('login')
  const [password, setPassword] = useState('')
  const [pwSubmitting, setPwSubmitting] = useState(false)

  const from = (location.state as { from?: string } | null)?.from || '/'

  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    return () => {
      if (cooldownTimer.current) clearInterval(cooldownTimer.current)
    }
  }, [])

  function startCooldown(seconds: number) {
    setCooldown(seconds)
    if (cooldownTimer.current) clearInterval(cooldownTimer.current)
    cooldownTimer.current = setInterval(() => {
      setCooldown((s) => {
        if (s <= 1) {
          if (cooldownTimer.current) clearInterval(cooldownTimer.current)
          return 0
        }
        return s - 1
      })
    }, 1000)
  }

  async function handleSendCode(e?: React.FormEvent) {
    e?.preventDefault()
    if (!email.trim()) return
    setError(null)
    setSending(true)
    try {
      await sendOtp(email.trim())
      setStep('code')
      startCooldown(60)
    } catch (err) {
      if (err instanceof ApiError && typeof err.waitSeconds === 'number') {
        startCooldown(err.waitSeconds)
      }
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSending(false)
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim()) return
    setError(null)
    setVerifying(true)
    try {
      await verifyOtp(email.trim(), code.trim())
      setVerified(true)
      setTimeout(() => navigate(from, { replace: true }), 400)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setVerifying(false)
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPwSubmitting(true)
    try {
      if (pwMode === 'login') await login(email, password)
      else await register(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setPwSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-surface-100 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-surface-500 bg-surface-200 p-8 shadow-soft">
        <h1 className="text-xl font-semibold text-ink-100">Nexforge Studio Manager</h1>
        <p className="mt-1 text-sm text-ink-400">
          {usePassword
            ? pwMode === 'login'
              ? 'Sign in to your studio.'
              : 'Create the owner account for this studio.'
            : step === 'email'
              ? "We'll email you a one-time sign-in code."
              : `Enter the code we sent to ${email}.`}
        </p>

        {!usePassword && step === 'email' && (
          <form onSubmit={handleSendCode} className="mt-6 space-y-4">
            <Input
              label="Email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {error && <p className="text-sm text-rose-400">{error}</p>}
            <Button type="submit" className="w-full" disabled={sending}>
              {sending ? 'Sending…' : 'Send code'}
            </Button>
          </form>
        )}

        {!usePassword && step === 'code' && (
          <form onSubmit={handleVerify} className="mt-6 space-y-4">
            <Input
              label="6-digit code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              autoFocus
              required
            />

            {error && <p className="text-sm text-rose-400">{error}</p>}
            {verified && <p className="text-sm text-emerald-400">Verified — signing you in…</p>}

            <Button type="submit" className="w-full" disabled={verifying || verified || code.length !== 6}>
              {verifying ? 'Verifying…' : verified ? 'Success' : 'Verify'}
            </Button>

            <div className="flex items-center justify-between text-xs text-ink-400">
              <button
                type="button"
                onClick={() => {
                  setStep('email')
                  setCode('')
                  setError(null)
                  setVerified(false)
                }}
                className="hover:text-ink-100"
              >
                Use a different email
              </button>
              <button
                type="button"
                disabled={cooldown > 0 || sending}
                onClick={() => handleSendCode()}
                className="hover:text-ink-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-ink-400"
              >
                {cooldown > 0 ? `Resend code in ${cooldown}s` : sending ? 'Sending…' : 'Resend code'}
              </button>
            </div>
          </form>
        )}

        {usePassword && (
          <form onSubmit={handlePasswordSubmit} className="mt-6 space-y-4">
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
              autoComplete={pwMode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />

            {error && <p className="text-sm text-rose-400">{error}</p>}

            <Button type="submit" className="w-full" disabled={pwSubmitting}>
              {pwSubmitting ? 'Please wait…' : pwMode === 'login' ? 'Sign in' : 'Create account'}
            </Button>

            <button
              type="button"
              className="text-xs text-ink-400 hover:text-ink-100"
              onClick={() => {
                setError(null)
                setPwMode(pwMode === 'login' ? 'register' : 'login')
              }}
            >
              {pwMode === 'login'
                ? 'First time setting this up? Create the owner account.'
                : 'Already have an account? Sign in.'}
            </button>
          </form>
        )}

        <button
          type="button"
          className="mt-4 text-xs text-ink-400 hover:text-ink-100 block"
          onClick={() => {
            setError(null)
            setUsePassword(!usePassword)
            setStep('email')
            setCode('')
            setVerified(false)
          }}
        >
          {usePassword ? 'Use an email code instead' : 'Use a password instead'}
        </button>
      </div>
    </div>
  )
}
