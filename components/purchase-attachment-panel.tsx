'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Attachment = {
  id: string
  file_name: string | null
  mime_type: string | null
  file_size: number | null
  created_at: string | null
  storage_path: string
}

const db = () => createClient()
const txt = (v: unknown) => String(v ?? '')
const allowed = new Set(['application/pdf','image/jpeg','image/png','image/webp'])

export default function PurchaseAttachmentPanel({ purchaseId, compact = false }: { purchaseId: string; compact?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)

  const load = async () => {
    const { data, error: e } = await db()
      .from('purchase_attachments')
      .select('id,file_name,mime_type,file_size,created_at,storage_path')
      .eq('purchase_id', purchaseId)
      .order('created_at', { ascending: false })
    if (e) {
      setError(true)
      setMessage(e.message)
      return
    }
    setAttachments((data ?? []) as Attachment[])
  }

  useEffect(() => { void load() }, [purchaseId])

  const upload = async (file: File) => {
    setBusy(true)
    setError(false)
    setMessage('')
    if (!allowed.has(file.type)) {
      setBusy(false)
      setError(true)
      setMessage('Choose a PDF or image file.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setBusy(false)
      setError(true)
      setMessage('The file is larger than 10 MB. Please choose a smaller invoice/slip.')
      return
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-120) || 'invoice-slip'
    const path = `purchases/${purchaseId}/${crypto.randomUUID()}-${safeName}`
    const client = db()
    const { error: uploadError } = await client.storage
      .from('purchase-attachments')
      .upload(path, file, { contentType: file.type, cacheControl: '3600', upsert: false })

    if (uploadError) {
      setBusy(false)
      setError(true)
      setMessage(uploadError.message)
      return
    }

    const { data: userData } = await client.auth.getUser()
    const { error: rowError } = await client.from('purchase_attachments').insert({
      purchase_id: purchaseId,
      storage_path: path,
      file_name: file.name,
      mime_type: file.type,
      file_size: file.size,
      uploaded_by: userData.user?.id ?? null,
    })

    if (rowError) {
      await client.storage.from('purchase-attachments').remove([path])
      setBusy(false)
      setError(true)
      setMessage(rowError.message)
      return
    }

    setBusy(false)
    setError(false)
    setMessage('Invoice / slip attached to this purchase.')
    await load()
  }

  const openFile = async (attachment: Attachment, download = false) => {
    const { data, error: e } = await db().storage
      .from('purchase-attachments')
      .createSignedUrl(attachment.storage_path, 60 * 30, download ? { download: true } : undefined)
    if (e || !data?.signedUrl) {
      setError(true)
      setMessage(e?.message || 'Could not open the attachment.')
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  return <div className={compact ? '' : 'console-panel'}>
    {!compact && <div className="panel-heading"><div><h2>Invoice / supporting documents</h2><span>{attachments.length} attached</span></div></div>}
    {attachments.length > 0 && <div className="table-wrap purchase-table-wrap" style={{ width: '100%', overflowX: 'auto' }}>
      <table style={{ width: 'max-content', minWidth: '100%' }}>
        <thead><tr><th>Document</th><th>Type</th><th>Size</th><th>Added</th><th>Actions</th></tr></thead>
        <tbody>{attachments.map(a => <tr key={a.id}>
          <td>{txt(a.file_name)}</td>
          <td>{txt(a.mime_type) || '—'}</td>
          <td>{a.file_size ? `${Math.round(a.file_size / 1024)} KB` : '—'}</td>
          <td>{a.created_at ? new Date(a.created_at).toLocaleString() : '—'}</td>
          <td><div className="purchase-actions" style={{ justifyContent: 'flex-start' }}>
            <button className="secondary-button" type="button" onClick={() => void openFile(a)}>View</button>
            <button className="secondary-button" type="button" onClick={() => void openFile(a, true)}>Download</button>
          </div></td>
        </tr>)}</tbody>
      </table>
    </div>}
    <div className="purchase-actions" style={{ justifyContent: 'flex-start', marginTop: attachments.length ? 12 : 0 }}>
      <input ref={inputRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" hidden onChange={e => { const f = e.target.files?.[0]; e.currentTarget.value = ''; if (f) void upload(f) }} />
      <button className="primary-button" type="button" disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? 'Uploading…' : 'Upload Invoice / Slip'}
      </button>
    </div>
    {message && <p className={`form-status${error ? ' form-status-error' : ''}`} role="alert">{message}</p>}
  </div>
}
