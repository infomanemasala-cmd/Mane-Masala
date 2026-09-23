'use client'

import { FormEvent, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const MIN_PASSWORD_LENGTH = 12
function policyError(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) return 'Password must be at least 12 characters.'
  if (!/[a-z]/.test(password)) return 'Password must contain a lowercase letter.'
  if (!/[A-Z]/.test(password)) return 'Password must contain an uppercase letter.'
  if (!/[0-9]/.test(password)) return 'Password must contain a number.'
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must contain a symbol.'
  return ''
}

export default function AccountPage() {
  const [email, setEmail] = useState(''), [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState(''), [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false), [showNew, setShowNew] = useState(false), [showConfirm, setShowConfirm] = useState(false)
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('')
  useEffect(() => { void createClient().auth.getUser().then(({ data }) => setEmail(data.user?.email ?? '')) }, [])
  const changePassword = async (event: FormEvent) => {
    event.preventDefault(); setMessage(''); setError('')
    if (!currentPassword) { setError('Enter your current password.'); return }
    const policy = policyError(newPassword); if (policy) { setError(policy); return }
    if (newPassword !== confirmPassword) { setError('New password and confirmation do not match.'); return }
    if (newPassword === currentPassword) { setError('New password must be different from the current password.'); return }
    setBusy(true)
    const sb = createClient()
    const { error: verifyError } = await sb.auth.signInWithPassword({ email, password: currentPassword })
    if (verifyError) { setBusy(false); setError('Current password is incorrect.'); return }
    const { error: updateError } = await sb.auth.updateUser({ password: newPassword, current_password: currentPassword })
    setBusy(false)
    if (updateError) { setError(updateError.message); return }
    setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setMessage('Password changed successfully.')
  }
  const logout = async () => { setBusy(true); const { error: e } = await createClient().auth.signOut(); setBusy(false); if (e) { setError(e.message); return } window.location.href = '/login' }
  return <main className="page-panel account-page"><div className="section-label">Account</div><div className="master-header"><div><h1>Account & Profile</h1><p>Signed in as {email || 'current user'}.</p></div><button className="secondary-button" type="button" onClick={() => void logout()} disabled={busy}>Log Out</button></div><section className="console-panel"><div className="panel-heading"><h2>Change Password</h2></div><form className="form-stack account-form" onSubmit={changePassword} autoComplete="off"><label>Current password<div className="password-field"><input type={showCurrent ? 'text' : 'password'} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} autoComplete="current-password" required/><button type="button" className="password-toggle" aria-label={showCurrent ? 'Hide current password' : 'Show current password'} onClick={() => setShowCurrent(v => !v)}>{showCurrent ? 'Hide' : 'Show'}</button></div></label><label>New password<div className="password-field"><input type={showNew ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} autoComplete="new-password" required/><button type="button" className="password-toggle" aria-label={showNew ? 'Hide new password' : 'Show new password'} onClick={() => setShowNew(v => !v)}>{showNew ? 'Hide' : 'Show'}</button></div></label><label>Confirm new password<div className="password-field"><input type={showConfirm ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" required/><button type="button" className="password-toggle" aria-label={showConfirm ? 'Hide password confirmation' : 'Show password confirmation'} onClick={() => setShowConfirm(v => !v)}>{showConfirm ? 'Hide' : 'Show'}</button></div></label><p className="muted">Use 12+ characters with uppercase, lowercase, a number and a symbol.</p><button className="primary-button" type="submit" disabled={busy}>{busy ? 'Updating…' : 'Change Password'}</button></form>{message && <p className="form-status form-status-success" role="status">{message}</p>}{error && <p className="form-status form-status-error" role="alert">{error}</p>}</section></main>
}
