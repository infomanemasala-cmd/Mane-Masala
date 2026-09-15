'use client'

import { FormEvent, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const MIN_PASSWORD_LENGTH = 12

function passwordPolicyError(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
  if (!/[a-z]/.test(password)) return 'Password must contain a lowercase letter.'
  if (!/[A-Z]/.test(password)) return 'Password must contain an uppercase letter.'
  if (!/[0-9]/.test(password)) return 'Password must contain a number.'
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must contain a symbol.'
  return ''
}

async function isLeakedPassword(password: string) {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(password))
  const hash = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase()
  const prefix = hash.slice(0, 5)
  const suffix = hash.slice(5)
  const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
    headers: { 'Add-Padding': 'true' },
    cache: 'no-store',
  })
  if (!response.ok) return false
  const body = await response.text()
  return body.split('\n').some((line) => line.split(':')[0]?.trim().toUpperCase() === suffix)
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage('')

    if (mode === 'signup') {
      const policyError = passwordPolicyError(password)
      if (policyError) {
        setMessage(policyError)
        setBusy(false)
        return
      }
      try {
        if (await isLeakedPassword(password)) {
          setMessage('Choose a different password. This password appears in known breach data.')
          setBusy(false)
          return
        }
      } catch {
        setMessage('Password security check is temporarily unavailable. Please try again.')
        setBusy(false)
        return
      }
    }

    const supabase = createClient()
    const next = new URLSearchParams(window.location.search).get('next') ?? '/dashboard'
    const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'
    const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}`

    const result = mode === 'signin'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo } })

    if (result.error) {
      setMessage(result.error.message)
      setBusy(false)
      return
    }

    if (mode === 'signup' && !result.data.session) {
      setMessage('Account created. Check your email to verify the account, then sign in.')
      setMode('signin')
      setBusy(false)
      return
    }

    window.location.href = safeNext
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand-mark">MM</div>
        <h1>Mane Masala</h1>
        <p className="muted">Business Management System</p>
        <h2>{mode === 'signin' ? 'Sign in' : 'Create account'}</h2>
        <form onSubmit={submit} className="form-stack">
          <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></label>
          <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={mode === 'signup' ? MIN_PASSWORD_LENGTH : 6} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} /></label>
          {mode === 'signup' && <p className="muted">Use 12+ characters with uppercase, lowercase, a number and a symbol. Known breached passwords are rejected.</p>}
          <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}</button>
        </form>
        {message && <p className="form-message" role="alert">{message}</p>}
        <button className="link-button" type="button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMessage('') }}>
          {mode === 'signin' ? 'Create the first account' : 'Back to sign in'}
        </button>
      </section>
    </main>
  )
}
