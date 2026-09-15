'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import DataTable from '@/components/data-table'

type Row = Record<string, any>
const sb = () => createClient()
const today = () => new Date().toISOString().slice(0, 10)
const text = (v: any) => String(v ?? '')

function Select({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) { return <select value={value} onChange={e => onChange(e.target.value)}>{children}</select> }
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="modal-backdrop"><div className="modal-card purchase-modal"><div className="modal-header"><h3>{title}</h3><button className="secondary-button" onClick={onClose}>Close</button></div>{children}</div></div> }
function Status({ message, error = false }: { message: string; error?: boolean }) { return message ? <p className={`form-status${error ? ' form-status-error' : ''}`}>{message}</p> : null }

export default function PurchaseConsoleV2() {
  const [suppliers, setSuppliers] = useState<Row[]>([]), [items, setItems] = useState<Row[]>([]), [categories, setCategories] = useState<Row[]>([]), [units, setUnits] = useState<Row[]>([])
  const [open, setOpen] = useState(false), [newItemOpen, setNewItemOpen] = useState(false), [newItemLine, setNewItemLine] = useState(0)
  const [sid, setSid] = useState(''), [purchaseDate, setPurchaseDate] = useState(today()), [invoiceNumber, setInvoiceNumber] = useState(''), [source, setSource] = useState('other'), [notes, setNotes] = useState('')
  const [lines, setLines] = useState([{ itemId: '', quantity: '', rate: '' }]), [createdPurchase, setCreatedPurchase] = useState<Row | null>(null), [file, setFile] = useState<File | null>(null), [msg, setMsg] = useState(''), [error, setError] = useState(false), [saving, setSaving] = useState(false)
  const [newItemName, setNewItemName] = useState(''), [newItemType, setNewItemType] = useState('raw_material'), [newCategory, setNewCategory] = useState(''), [newUnit, setNewUnit] = useState(''), [newMinimum, setNewMinimum] = useState('2')
  const fileRef = useRef<HTMLInputElement>(null)

  const loadMasters = async () => {
    const [s, i, c, u] = await Promise.all([
      sb().from('suppliers').select('*').eq('is_active', true).order('business_name').limit(200),
      sb().from('items').select('*').eq('is_active', true).order('name').limit(300),
      sb().from('categories').select('*').order('name').limit(100),
      sb().from('units').select('*').order('name').limit(50),
    ])
    setSuppliers((s.data ?? []) as Row[]); setItems((i.data ?? []) as Row[]); setCategories((c.data ?? []) as Row[]); setUnits((u.data ?? []) as Row[])
  }
  useEffect(() => { void loadMasters() }, [])

  const updateLine = (index: number, key: 'itemId' | 'quantity' | 'rate', value: string) => setLines(prev => prev.map((l, i) => i === index ? { ...l, [key]: value } : l))
  const addLine = () => setLines(prev => [...prev, { itemId: '', quantity: '', rate: '' }])
  const removeLine = (index: number) => setLines(prev => prev.length === 1 ? prev : prev.filter((_, i) => i !== index))
  const selectItem = (index: number, value: string) => { if (value === '__new__') { setNewItemLine(index); setNewItemOpen(true); return } updateLine(index, 'itemId', value) }

  const createItem = async () => {
    setError(false); setMsg('')
    if (!newItemName.trim() || !newUnit) { setError(true); setMsg('Item name and unit are required.'); return }
    const payload = { name: newItemName.trim(), item_type: newItemType, category_id: newCategory || null, purchase_unit_id: newUnit, base_unit_id: newUnit, selling_unit_id: newUnit, minimum_stock: Number(newMinimum || 0), is_perishable: false, expiry_tracking_enabled: false, is_active: true, can_be_sold: newItemType !== 'raw_material', can_be_used_in_production: newItemType !== 'purchased_finished_product', is_intermediate: newItemType === 'intermediate' }
    const { data, error: e } = await sb().from('items').insert(payload).select().single()
    if (e) { setError(true); setMsg(e.message); return }
    setItems(prev => [...prev, data as Row].sort((a, b) => text(a.name).localeCompare(text(b.name))))
    updateLine(newItemLine, 'itemId', text(data.id)); setNewItemOpen(false); setNewItemName(''); setNewCategory(''); setNewUnit(''); setNewMinimum('2'); setMsg(`New item “${text(data.name)}” created and selected.`)
  }

  const createPurchase = async () => {
    setError(false); setMsg('')
    const valid = lines.filter(l => l.itemId && Number(l.quantity) > 0)
    if (!sid) { setError(true); setMsg('Select the supplier first.'); return }
    if (!valid.length) { setError(true); setMsg('Add at least one item with a quantity.'); return }
    setSaving(true)
    const { data: purchase, error: pe } = await sb().from('purchases').insert({ supplier_id: sid, purchase_date: purchaseDate, supplier_invoice_number: invoiceNumber.trim() || null, purchase_source: source, financial_status: 'unpaid', workflow_status: 'received', notes: notes.trim() || null }).select().single()
    if (pe || !purchase) { setSaving(false); setError(true); setMsg(pe?.message ?? 'Could not create purchase.'); return }
    const payload = valid.map(l => { const item = items.find(x => text(x.id) === l.itemId); const qty = Number(l.quantity); const rate = l.rate === '' ? null : Number(l.rate); return { purchase_id: purchase.id, item_id: l.itemId, billed_quantity: qty, unit_id: item?.base_unit_id, unit_rate: rate, line_total: rate == null ? null : qty * rate } })
    const { error: le } = await sb().from('purchase_lines').insert(payload)
    if (le) { setSaving(false); setError(true); setMsg(`Purchase header saved, but lines failed: ${le.message}`); return }
    setCreatedPurchase(purchase); setSaving(false); setMsg('Purchase saved. Attach the invoice or shopkeeper slip next.')
  }

  const uploadAttachment = async () => {
    if (!createdPurchase || !file) return
    setError(false); setMsg('Uploading document...')
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_'), path = `${createdPurchase.id}/${Date.now()}-${safe}`
    const { error: ue } = await sb().storage.from('purchase-attachments').upload(path, file, { upsert: false })
    if (ue) { setError(true); setMsg(ue.message); return }
    const { data: user } = await sb().auth.getUser()
    const { error: ae } = await sb().from('purchase_attachments').insert({ purchase_id: createdPurchase.id, storage_path: path, file_name: file.name, mime_type: file.type || 'application/octet-stream', file_size: file.size, uploaded_by: user.user?.id ?? null })
    if (ae) { setError(true); setMsg(`File uploaded, but could not link it: ${ae.message}`); return }
    setMsg('Invoice / slip attached successfully.'); setFile(null); if (fileRef.current) fileRef.current.value = ''
  }
  const close = () => { setOpen(false); setNewItemOpen(false); setCreatedPurchase(null); setFile(null); setMsg(''); setError(false); setLines([{ itemId: '', quantity: '', rate: '' }]); setSid(''); setInvoiceNumber(''); setNotes(''); setPurchaseDate(today()) }

  return <section className="page-panel"><div className="section-label">Mane Masala</div><div className="master-header"><div><h1>Purchases</h1><p className="page-intro">One supplier → one bill → multiple items → one saved document.</p></div><button className="primary-button" onClick={() => { setMsg(''); setError(false); setOpen(true) }}>+ Create Purchase</button></div>
    {open && <Modal title={createdPurchase ? `Purchase ${text(createdPurchase.business_code)}` : 'Create Purchase'} onClose={close}>
      {!createdPurchase ? <><div className="purchase-step"><span>1</span><div><strong>Supplier and bill</strong><small>Select the supplier once. Every item row belongs to this same bill.</small></div></div><div className="form-grid purchase-form-grid"><label className="field"><span>Supplier</span><Select value={sid} onChange={setSid}><option value="">Select supplier</option>{suppliers.map(s => <option key={text(s.id)} value={text(s.id)}>{text(s.business_name)}</option>)}</Select></label><label className="field"><span>Bill date</span><input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} /></label><label className="field"><span>Supplier invoice number <em>optional</em></span><input placeholder="If written on the bill" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} /></label><label className="field"><span>Source</span><Select value={source} onChange={setSource}><option value="whatsapp">WhatsApp</option><option value="phone">Phone</option><option value="walk_in">Walk-in</option><option value="online">Online</option><option value="other">Other</option></Select></label></div><div className="purchase-step"><span>2</span><div><strong>Items on this bill</strong><small>Add as many item rows as the supplier bill contains.</small></div></div><div className="purchase-lines">{lines.map((line, index) => <div className="purchase-line" key={index}><label className="field item-field"><span>Item</span><Select value={line.itemId} onChange={v => selectItem(index, v)}><option value="">Select item</option>{items.map(item => <option key={text(item.id)} value={text(item.id)}>{text(item.item_code) ? `${text(item.item_code)} — ` : ''}{text(item.name)}</option>)}<option value="__new__">＋ Create new Item</option></Select></label><label className="field"><span>Quantity</span><input type="number" min="0" step="0.001" placeholder="0" value={line.quantity} onChange={e => updateLine(index, 'quantity', e.target.value)} /></label><label className="field"><span>Rate / unit <em>optional</em></span><input type="number" min="0" step="0.01" placeholder="0.00" value={line.rate} onChange={e => updateLine(index, 'rate', e.target.value)} /></label><div className="purchase-line-total">{line.quantity && line.rate ? `₹ ${(Number(line.quantity) * Number(line.rate)).toFixed(2)}` : 'Rate not entered'}</div><button className="line-remove" type="button" onClick={() => removeLine(index)} disabled={lines.length === 1}>Remove</button></div>)}</div><button className="add-row-button" type="button" onClick={addLine}>＋ Add item row</button><label className="field purchase-notes"><span>Notes <em>optional</em></span><textarea placeholder="Anything useful about this bill" value={notes} onChange={e => setNotes(e.target.value)} /></label><div className="purchase-actions"><button className="primary-button" onClick={createPurchase} disabled={saving}>{saving ? 'Saving...' : 'Create Purchase & continue'}</button></div><Status message={msg} error={error}/></> : <><div className="purchase-complete-banner"><strong>Purchase saved</strong><span>{text(createdPurchase.business_code)} · {purchaseDate}</span></div><div className="purchase-step"><span>3</span><div><strong>Attach the invoice / shopkeeper slip</strong><small>Take a photo on mobile, or choose a PDF/document on desktop.</small></div></div><div className="attachment-box"><input ref={fileRef} type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv" onChange={e => setFile(e.target.files?.[0] ?? null)} /><div>{file ? <strong>{file.name}</strong> : 'Choose invoice or written slip'}</div><button className="primary-button" onClick={uploadAttachment} disabled={!file}>Upload & attach</button></div><Status message={msg} error={error}/><div className="purchase-actions"><button className="secondary-button" onClick={close}>Finish</button></div></>}
    </Modal>}
    {newItemOpen && <Modal title="Create Item without leaving Purchase" onClose={() => setNewItemOpen(false)}><p className="muted">Create the item here. When saved, you return to the same purchase row with the new item selected.</p><div className="form-grid"><label className="field"><span>Item name</span><input autoFocus value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="e.g. New chilli powder" /></label><label className="field"><span>Item type</span><Select value={newItemType} onChange={setNewItemType}><option value="raw_material">Raw Material</option><option value="intermediate">Intermediate / Prepared Material</option><option value="finished_product">Finished Product</option><option value="purchased_finished_product">Purchased Finished Product</option></Select></label><label className="field"><span>Category <em>optional</em></span><Select value={newCategory} onChange={setNewCategory}><option value="">No category</option>{categories.map(c => <option key={text(c.id)} value={text(c.id)}>{text(c.name)}</option>)}</Select></label><label className="field"><span>Unit</span><Select value={newUnit} onChange={setNewUnit}><option value="">Select unit</option>{units.map(u => <option key={text(u.id)} value={text(u.id)}>{text(u.name)} ({text(u.symbol)})</option>)}</Select></label><label className="field"><span>Minimum stock</span><input type="number" min="0" step="0.001" value={newMinimum} onChange={e => setNewMinimum(e.target.value)} /></label></div><Status message={msg} error={error}/><div className="nested-modal-actions"><button className="secondary-button" onClick={() => setNewItemOpen(false)}>Cancel</button><button className="primary-button" onClick={createItem}>Create Item</button></div></Modal>}
    <div style={{ marginTop: 18 }}><DataTable table="purchases"/></div>
  </section>
}
