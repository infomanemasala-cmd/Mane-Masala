'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import DataTable from '@/components/data-table'

type Row = Record<string, any>
const db = () => createClient()
const today = () => new Date().toISOString().slice(0, 10)
const txt = (v: any) => String(v ?? '')

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="field"><span>{label}</span>{children}</label> }
function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) { return <div className="modal-backdrop"><div className="modal-card purchase-modal"><div className="modal-header"><h3>{title}</h3><button className="secondary-button" onClick={close}>Close</button></div>{children}</div></div> }
function Status({ message, error }: { message: string; error: boolean }) { return message ? <p className={`form-status${error ? ' form-status-error' : ''}`} role="alert">{message}</p> : null }
function blankLine() { return { itemId: '', qty: '', rate: '', discount: '', tax: '', notes: '' } }

export default function PurchaseConsoleFinal2() {
  const [suppliers, setSuppliers] = useState<Row[]>([])
  const [items, setItems] = useState<Row[]>([])
  const [categories, setCategories] = useState<Row[]>([])
  const [units, setUnits] = useState<Row[]>([])
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'entry' | 'receipt' | 'attach'>('entry')
  const [supplierId, setSupplierId] = useState('')
  const [date, setDate] = useState(today())
  const [invoice, setInvoice] = useState('')
  const [source, setSource] = useState('other')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<any[]>([blankLine()])
  const [discount, setDiscount] = useState('0')
  const [tax, setTax] = useState('0')
  const [delivery, setDelivery] = useState('0')
  const [transport, setTransport] = useState('0')
  const [loadingCharge, setLoadingCharge] = useState('0')
  const [unloadingCharge, setUnloadingCharge] = useState('0')
  const [packingCharge, setPackingCharge] = useState('0')
  const [otherCharge, setOtherCharge] = useState('0')
  const [createdPurchase, setCreatedPurchase] = useState<Row | null>(null)
  const [receiptLines, setReceiptLines] = useState<Row[]>([])
  const [file, setFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [itemOpen, setItemOpen] = useState(false)
  const [itemLineIndex, setItemLineIndex] = useState(0)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('raw_material')
  const [newCategory, setNewCategory] = useState('')
  const [newUnit, setNewUnit] = useState('')
  const [newMin, setNewMin] = useState('2')

  const loadMasters = async () => {
    const [s, i, c, u] = await Promise.all([
      db().from('suppliers').select('*').eq('is_active', true).order('business_name'),
      db().from('items').select('*').eq('is_active', true).order('name'),
      db().from('categories').select('id,code,name').eq('is_active', true).order('name'),
      db().from('units').select('id,name,symbol').eq('is_active', true).order('name')
    ])
    setSuppliers(s.data ?? []); setItems(i.data ?? []); setCategories(c.data ?? []); setUnits(u.data ?? [])
  }
  useEffect(() => { void loadMasters() }, [])

  const updateLine = (index: number, patch: Row) => setLines(v => v.map((x, i) => i === index ? { ...x, ...patch } : x))
  const total = lines.reduce((sum, l) => sum + Number(l.qty || 0) * Number(l.rate || 0) - Number(l.discount || 0) + Number(l.tax || 0), 0)
    - Number(discount || 0) + Number(tax || 0) + Number(delivery || 0) + Number(transport || 0) + Number(loadingCharge || 0) + Number(unloadingCharge || 0) + Number(packingCharge || 0) + Number(otherCharge || 0)

  const savePurchase = async () => {
    setMessage(''); setError(false)
    const valid = lines.filter(l => l.itemId && Number(l.qty) > 0)
    if (!supplierId) { setError(true); setMessage('Select a supplier.'); return }
    if (!valid.length) { setError(true); setMessage('Add at least one item with a quantity.'); return }
    if (invoice.trim()) {
      const { data } = await db().from('purchases').select('id').eq('supplier_id', supplierId).eq('supplier_invoice_number', invoice.trim()).limit(1)
      if (data?.length) { setError(true); setMessage('This supplier invoice number already exists for this supplier. Check it before continuing.'); return }
    }
    setSaving(true)
    const { data, error: e } = await db().rpc('create_purchase_entry', {
      p_supplier_id: supplierId, p_purchase_date: date, p_supplier_invoice_number: invoice,
      p_purchase_source: source, p_lines: valid.map(l => ({ item_id: l.itemId, billed_quantity: Number(l.qty), unit_rate: l.rate === '' ? null : Number(l.rate), discount_amount: Number(l.discount || 0), tax_amount: Number(l.tax || 0), notes: l.notes.trim() || null })),
      p_discount_amount: Number(discount || 0), p_delivery_charge: Number(delivery || 0), p_transport_charge: Number(transport || 0), p_loading_charge: Number(loadingCharge || 0), p_unloading_charge: Number(unloadingCharge || 0), p_packing_charge: Number(packingCharge || 0), p_other_charge: Number(otherCharge || 0), p_tax_amount: Number(tax || 0), p_notes: notes.trim() || null
    })
    setSaving(false)
    if (e || !data) { setError(true); setMessage(e?.message || 'Could not create purchase.'); return }
    const pid = txt(data.purchase_id)
    const { data: pl, error: pe } = await db().from('purchase_lines').select('id,item_id,billed_quantity,unit_id,unit_rate,line_total').eq('purchase_id', pid)
    if (pe) { setError(true); setMessage(pe.message); return }
    setCreatedPurchase({ ...data, id: pid });
    setReceiptLines((pl ?? []).map(x => ({ ...x, received_quantity: txt(x.billed_quantity), accepted_quantity: txt(x.billed_quantity), rejected_quantity: '0', inspection_notes: '' })))
    setStep('receipt'); setMessage('Purchase saved. Now check physical receipt and acceptance into stock.')
  }

  const recordReceipt = async () => {
    if (!createdPurchase) return
    for (const l of receiptLines) {
      if (Number(l.accepted_quantity) + Number(l.rejected_quantity) !== Number(l.received_quantity)) { setError(true); setMessage('Accepted + Rejected must equal Received on every line.'); return }
    }
    const { error: e } = await db().rpc('receive_purchase', {
      p_purchase_id: createdPurchase.id,
      p_lines: receiptLines.map(l => ({ purchase_line_id: l.id, received_quantity: Number(l.received_quantity || 0), accepted_quantity: Number(l.accepted_quantity || 0), rejected_quantity: Number(l.rejected_quantity || 0), replacement_quantity: 0, received_batch_date: date, notes: l.inspection_notes || null })),
      p_received_at: new Date().toISOString()
    })
    if (e) { setError(true); setMessage(e.message); return }
    setError(false); setStep('attach'); setMessage('Receipt and stock inspection recorded. Accepted quantity is now inventory. Attach the source document.')
  }

  const attach = async () => {
    if (!createdPurchase || !file) return
    setMessage('Uploading…'); setError(false)
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${createdPurchase.id}/${Date.now()}-${safe}`
    const { error: ue } = await db().storage.from('purchase-attachments').upload(path, file, { upsert: false })
    if (ue) { setError(true); setMessage(ue.message); return }
    const { data: user } = await db().auth.getUser()
    const { error: ae } = await db().from('purchase_attachments').insert({ purchase_id: createdPurchase.id, storage_path: path, file_name: file.name, mime_type: file.type || 'application/octet-stream', file_size: file.size, uploaded_by: user.user?.id ?? null })
    if (ae) { setError(true); setMessage(`Document uploaded but could not be linked: ${ae.message}`); return }
    setError(false); setMessage('Invoice / slip attached successfully. The purchase can now be completed after invoice inspection.')
  }

  const completePurchase = async () => {
    if (!createdPurchase) return
    const { error: e } = await db().rpc('complete_purchase_inspection', { p_purchase_id: createdPurchase.id })
    if (e) { setError(true); setMessage(e.message); return }
    setError(false); setMessage('Purchase completed. Supplier outstanding now starts from the completed financial purchase.')
  }

  const close = () => {
    setOpen(false); setItemOpen(false); setStep('entry'); setSupplierId(''); setInvoice(''); setNotes(''); setLines([blankLine()]); setCreatedPurchase(null); setReceiptLines([]); setFile(null); setMessage(''); setError(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const createItem = async () => {
    if (!newName.trim() || !newUnit) { setError(true); setMessage('Item name and unit are required.'); return }
    const payload = { name: newName.trim(), item_type: newType, category_id: newCategory || null, purchase_unit_id: newUnit, base_unit_id: newUnit, selling_unit_id: newUnit, minimum_stock: Number(newMin || 0), is_active: true, can_be_sold: newType !== 'raw_material', can_be_used_in_production: newType !== 'purchased_finished_product', is_intermediate: newType === 'intermediate', is_perishable: false, expiry_tracking_enabled: false }
    const { data, error: e } = await db().from('items').insert(payload).select().single()
    if (e) { setError(true); setMessage(e.message); return }
    setItems(v => [...v, data].sort((a, b) => txt(a.name).localeCompare(txt(b.name))))
    updateLine(itemLineIndex, { itemId: data.id }); setItemOpen(false); setNewName(''); setNewCategory(''); setNewUnit(''); setNewMin('2'); setError(false); setMessage(`Item ${txt(data.item_code || data.business_code)} created and selected.`)
  }

  return <section className="page-panel">
    <div className="section-label">Mane Masala</div>
    <div className="master-header"><div><h1>Purchases</h1><p className="page-intro">Supplier bill → multiple items → receive & inspect → accepted stock → attach bill/slip → invoice inspection → completed.</p></div><button className="primary-button" onClick={() => setOpen(true)}>+ Create Purchase</button></div>
    {open && <Modal title={step === 'entry' ? 'Create Purchase' : step === 'receipt' ? 'Receive & Inspect Purchase' : 'Attach & Complete Purchase'} close={close}>
      {step === 'entry' && <>
        <div className="purchase-step"><span>1</span><div><strong>Supplier and bill</strong><small>One supplier for this purchase; add every bill item below.</small></div></div>
        <div className="form-grid"><Field label="Supplier"><select value={supplierId} onChange={e => setSupplierId(e.target.value)}><option value="">Select supplier</option>{suppliers.map(s => <option key={txt(s.id)} value={txt(s.id)}>{txt(s.business_name)} — {txt(s.business_code)}</option>)}</select></Field><Field label="Bill date"><input type="date" value={date} onChange={e => setDate(e.target.value)} /></Field><Field label="Supplier invoice number"><input value={invoice} onChange={e => setInvoice(e.target.value)} placeholder="Optional for handwritten bill" /></Field><Field label="Source"><select value={source} onChange={e => setSource(e.target.value)}>{['whatsapp','phone','walk_in','online','other'].map(x => <option key={x} value={x}>{x.replaceAll('_',' ')}</option>)}</select></Field></div>
        <h3>Items on this bill</h3>{lines.map((l, i) => <div className="purchase-line" key={i}><Field label="Item"><select value={l.itemId} onChange={e => { if (e.target.value === '__new__') { setItemLineIndex(i); setItemOpen(true) } else updateLine(i, { itemId: e.target.value }) }}><option value="">Select item</option>{items.map(it => <option key={txt(it.id)} value={txt(it.id)}>{txt(it.item_code || it.business_code)} — {txt(it.name)}</option>)}<option value="__new__">＋ Create new Item</option></select></Field><Field label="Quantity"><input type="number" min="0" step="0.001" value={l.qty} onChange={e => updateLine(i, { qty: e.target.value })} /></Field><Field label="Rate / unit"><input type="number" min="0" step="0.01" value={l.rate} onChange={e => updateLine(i, { rate: e.target.value })} placeholder="Optional" /></Field><Field label="Line discount"><input type="number" min="0" step="0.01" value={l.discount} onChange={e => updateLine(i, { discount: e.target.value })} /></Field><button className="line-remove" onClick={() => setLines(v => v.length === 1 ? v : v.filter((_, n) => n !== i))} disabled={lines.length === 1}>Remove</button></div>)}
        <button className="add-row-button" onClick={() => setLines(v => [...v, blankLine()])}>＋ Add item row</button>
        <div className="form-grid"><Field label="Bill discount"><input type="number" min="0" step="0.01" value={discount} onChange={e => setDiscount(e.target.value)} /></Field><Field label="Tax"><input type="number" min="0" step="0.01" value={tax} onChange={e => setTax(e.target.value)} /></Field><Field label="Delivery"><input type="number" min="0" step="0.01" value={delivery} onChange={e => setDelivery(e.target.value)} /></Field><Field label="Transport"><input type="number" min="0" step="0.01" value={transport} onChange={e => setTransport(e.target.value)} /></Field><Field label="Loading"><input type="number" min="0" step="0.01" value={loadingCharge} onChange={e => setLoadingCharge(e.target.value)} /></Field><Field label="Unloading"><input type="number" min="0" step="0.01" value={unloadingCharge} onChange={e => setUnloadingCharge(e.target.value)} /></Field><Field label="Packing"><input type="number" min="0" step="0.01" value={packingCharge} onChange={e => setPackingCharge(e.target.value)} /></Field><Field label="Other charges"><input type="number" min="0" step="0.01" value={otherCharge} onChange={e => setOtherCharge(e.target.value)} /></Field></div>
        <p className="purchase-total"><strong>Estimated bill total: ₹ {Math.max(0, total).toFixed(2)}</strong></p><Field label="Notes"><textarea value={notes} onChange={e => setNotes(e.target.value)} /></Field><Status message={message} error={error} /><button className="primary-button" onClick={savePurchase} disabled={saving}>{saving ? 'Saving…' : 'Save Purchase & check receipt'}</button>
      </>}
      {step === 'receipt' && <><div className="purchase-complete-banner"><strong>Purchase {txt(createdPurchase?.business_code)} saved</strong><span>Financial billed quantity remains separate from accepted physical stock.</span></div><h3>Receive and inspect</h3>{receiptLines.map((l, i) => <div className="purchase-line" key={txt(l.id)}><div className="field"><span>Item</span><div>{txt(items.find(it => txt(it.id) === txt(l.item_id))?.item_code)} — {txt(items.find(it => txt(it.id) === txt(l.item_id))?.name)}</div></div><Field label="Billed"><input value={txt(l.billed_quantity)} readOnly /></Field><Field label="Received"><input type="number" min="0" step="0.001" value={l.received_quantity} onChange={e => setReceiptLines(v => v.map((x, n) => n === i ? { ...x, received_quantity: e.target.value } : x))} /></Field><Field label="Accepted"><input type="number" min="0" step="0.001" value={l.accepted_quantity} onChange={e => setReceiptLines(v => v.map((x, n) => n === i ? { ...x, accepted_quantity: e.target.value } : x))} /></Field><Field label="Rejected"><input type="number" min="0" step="0.001" value={l.rejected_quantity} onChange={e => setReceiptLines(v => v.map((x, n) => n === i ? { ...x, rejected_quantity: e.target.value } : x))} /></Field><Field label="Inspection notes"><input value={l.inspection_notes} onChange={e => setReceiptLines(v => v.map((x, n) => n === i ? { ...x, inspection_notes: e.target.value } : x))} /></Field></div>)}<Status message={message} error={error} /><button className="primary-button" onClick={recordReceipt}>Record Receipt & Inspection</button></>}
      {step === 'attach' && <><div className="purchase-step"><span>3</span><div><strong>Attach source document</strong><small>Keep the invoice or handwritten slip linked to this purchase.</small></div></div><div className="attachment-box"><input ref={fileRef} type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv" onChange={e => setFile(e.target.files?.[0] ?? null)} /><div>{file ? <strong>{file.name}</strong> : 'Choose invoice or written slip'}</div><button className="primary-button" onClick={attach} disabled={!file}>Upload & attach</button></div><Status message={message} error={error} /><button className="primary-button" onClick={completePurchase}>Mark invoice inspected & complete</button></>}
    </Modal>}
    {itemOpen && <Modal title="Create Item without leaving Purchase" close={() => setItemOpen(false)}><p className="muted">The purchase line stays intact and the new item will be selected automatically.</p><div className="form-grid"><Field label="Item name"><input autoFocus value={newName} onChange={e => setNewName(e.target.value)} /></Field><Field label="Item type"><select value={newType} onChange={e => setNewType(e.target.value)}><option value="raw_material">Raw material</option><option value="intermediate">Intermediate / prepared material</option><option value="finished_product">Finished product</option><option value="purchased_finished_product">Purchased finished product</option></select></Field><Field label="Category"><select value={newCategory} onChange={e => setNewCategory(e.target.value)}><option value="">No category</option>{categories.map(c => <option key={txt(c.id)} value={txt(c.id)}>{txt(c.code)} — {txt(c.name)}</option>)}</select></Field><Field label="Unit"><select value={newUnit} onChange={e => setNewUnit(e.target.value)}><option value="">Select unit</option>{units.map(u => <option key={txt(u.id)} value={txt(u.id)}>{txt(u.name)} ({txt(u.symbol)})</option>)}</select></Field><Field label="Minimum stock"><input type="number" min="0" step="0.001" value={newMin} onChange={e => setNewMin(e.target.value)} /></Field></div><Status message={message} error={error} /><button className="primary-button" onClick={createItem}>Create Item</button></Modal>}
    <div className="console-panel"><div className="panel-heading"><h2>Purchases</h2></div><DataTable table="v_purchases_list" /></div>
  </section>
}
