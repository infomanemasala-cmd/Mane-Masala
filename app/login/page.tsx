'use client'

import { FormEvent, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

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
    const supabase = createClient()
    const result = mode === 'signin'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password })

    if (result.error) {
      setMessage(result.error.message)
      setBusy(false)
      return
    }

    if (mode === 'signup' && !result.data.session) {
      setMessage('Account created. Check your email if confirmation is required, then sign in.')
      setMode('signin')
      setBusy(false)
      return
    }

    window.location.href = '/dashboard'
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
          <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} /></label>
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
