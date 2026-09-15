'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import DataTable from '@/components/data-table'

type Row = Record<string, any>
const db = () => createClient()
const today = () => new Date().toISOString().slice(0, 10)
const txt = (v: any) => String(v ?? '')

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="field"><span>{label}</span>{children}</label> }
function CurrencyField({ label, value, onChange, placeholder = '' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) { return <Field label={label}><div className="currency-field"><span>₹</span><input type="number" min="0" step="0.01" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} /></div></Field> }
function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) { return <div className="modal-backdrop"><div className="modal-card purchase-modal"><div className="modal-header"><h3>{title}</h3><button className="secondary-button" type="button" onClick={close}>Cancel</button></div>{children}</div></div> }
function Status({ message, error }: { message: string; error: boolean }) { return message ? <p className={`form-status${error ? ' form-status-error' : ''}`} role="alert">{message}</p> : null }
function blankLine() { return { itemId: '', qty: '', rate: '', discount: '', discountType: 'value', tax: '', notes: '' } }
function blankPayment() { return { stage: 'bill', amount: '', date: today(), method: 'upi', reference: '', notes: '' } }

export default function PurchaseConsoleV2() {
  const [suppliers, setSuppliers] = useState<Row[]>([])
  const [items, setItems] = useState<Row[]>([])
  const [categories, setCategories] = useState<Row[]>([])
  const [units, setUnits] = useState<Row[]>([])
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'entry' | 'receipt' | 'attach' | 'payment' | 'done'>('entry')
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
  const [paymentMode, setPaymentMode] = useState<'now' | 'later' | 'credit'>('later')
  const [payments, setPayments] = useState<any[]>([blankPayment()])
  const [createdPurchase, setCreatedPurchase] = useState<Row | null>(null)
  const [receiptLines, setReceiptLines] = useState<Row[]>([])
  const [file, setFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)
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
  const lineDiscount = (l: any) => { const gross = Number(l.qty || 0) * Number(l.rate || 0); return l.discountType === 'percent' ? gross * Number(l.discount || 0) / 100 : Number(l.discount || 0) }
  const lineTotal = (l: any) => Math.max(0, Number(l.qty || 0) * Number(l.rate || 0) - lineDiscount(l) + Number(l.tax || 0))
  const total = lines.reduce((sum, l) => sum + lineTotal(l), 0) - Number(discount || 0) + Number(tax || 0) + Number(delivery || 0) + Number(transport || 0) + Number(loadingCharge || 0) + Number(unloadingCharge || 0) + Number(packingCharge || 0) + Number(otherCharge || 0)

  const savePurchase = async () => {
    setMessage(''); setError(false)
    const valid = lines.filter(l => l.itemId && Number(l.qty) > 0)
    if (!supplierId) { setError(true); setMessage('Select a supplier.'); return }
    if (!valid.length) { setError(true); setMessage('Add at least one item with a quantity.'); return }
    if (valid.some(l => Number(l.rate) < 0 || Number(l.discount) < 0 || Number(l.tax) < 0)) { setError(true); setMessage('Rate, discount and tax cannot be negative.'); return }
    if (invoice.trim()) {
      const { data } = await db().from('purchases').select('id').eq('supplier_id', supplierId).eq('supplier_invoice_number', invoice.trim()).limit(1)
      if (data?.length) { setError(true); setMessage('This supplier invoice number already exists for this supplier. Check it before continuing.'); return }
    }
    setSaving(true)
    const { data, error: e } = await db().rpc('create_purchase_entry', {
      p_supplier_id: supplierId, p_purchase_date: date, p_supplier_invoice_number: invoice.trim() || null,
      p_purchase_source: source, p_lines: valid.map(l => ({ item_id: l.itemId, billed_quantity: Number(l.qty), unit_rate: l.rate === '' ? null : Number(l.rate), discount_amount: lineDiscount(l), tax_amount: Number(l.tax || 0), notes: l.notes.trim() || null })),
      p_discount_amount: Number(discount || 0), p_delivery_charge: Number(delivery || 0), p_transport_charge: Number(transport || 0), p_loading_charge: Number(loadingCharge || 0), p_unloading_charge: Number(unloadingCharge || 0), p_packing_charge: Number(packingCharge || 0), p_other_charge: Number(otherCharge || 0), p_tax_amount: Number(tax || 0), p_notes: notes.trim() || null
    })
    setSaving(false)
    if (e || !data) { setError(true); setMessage(e?.message || 'Could not create purchase.'); return }
    const pid = txt(data.purchase_id)
    const { data: pl, error: pe } = await db().from('purchase_lines').select('id,item_id,billed_quantity,unit_id,unit_rate,line_total').eq('purchase_id', pid).order('created_at')
    if (pe) { setError(true); setMessage(pe.message); return }
    setCreatedPurchase({ ...data, id: pid })
    setReceiptLines((pl ?? []).map(x => ({ ...x, received_quantity: txt(x.billed_quantity), accepted_quantity: txt(x.billed_quantity), rejected_quantity: '0', inspection_notes: '' })))
    setRefreshToken(v => v + 1)
    setStep('receipt'); setMessage('Purchase saved. Now check the physical receipt and acceptance into stock.')
  }

  const recordReceipt = async () => {
    if (!createdPurchase) return
    for (const l of receiptLines) {
      if (Number(l.received_quantity) < 0 || Number(l.accepted_quantity) < 0 || Number(l.rejected_quantity) < 0 || Number(l.accepted_quantity) + Number(l.rejected_quantity) !== Number(l.received_quantity)) { setError(true); setMessage('Received, Accepted and Rejected must be valid and Accepted + Rejected must equal Received on every line.'); return }
    }
    const { error: e } = await db().rpc('receive_purchase', {
      p_purchase_id: createdPurchase.id,
      p_lines: receiptLines.map(l => ({ purchase_line_id: l.id, received_quantity: Number(l.received_quantity || 0), accepted_quantity: Number(l.accepted_quantity || 0), rejected_quantity: Number(l.rejected_quantity || 0), replacement_quantity: 0, received_batch_date: date, notes: l.inspection_notes || null })),
      p_received_at: new Date().toISOString()
    })
    if (e) { setError(true); setMessage(e.message); return }
    setRefreshToken(v => v + 1); setError(false); setStep('attach'); setMessage('Receipt and stock inspection recorded. Accepted quantity is now inventory.')
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
    setRefreshToken(v => v + 1); setError(false); setMessage('Invoice / slip attached successfully.')
  }

  const recordPayments = async () => {
    if (!createdPurchase) return
    if (paymentMode === 'credit' || paymentMode === 'later') { setStep('done'); return }
    const clean = payments.filter(p => Number(p.amount) > 0)
    if (!clean.length) { setError(true); setMessage('Add at least one payment, or choose Record later / Credit.'); return }
    for (const p of clean) {
      const { error: e } = await db().rpc('record_supplier_payment_allocated', {
        p_supplier_id: supplierId, p_amount: Number(p.amount), p_payment_date: p.date, p_method: p.method,
        p_allocations: [{ purchase_id: createdPurchase.id, amount: Number(p.amount) }],
        p_upi_reference: p.reference.trim() || null, p_notes: `${p.stage === 'advance' ? 'Advance toward purchase' : 'Bill payment'}${p.notes.trim() ? ` — ${p.notes.trim()}` : ''}`
      })
      if (e) { setError(true); setMessage(`Payment ${p.date} could not be recorded: ${e.message}`); return }
    }
    setRefreshToken(v => v + 1); setError(false); setMessage(`${clean.length} payment${clean.length === 1 ? '' : 's'} recorded and linked to this purchase.`); setStep('done')
  }

  const completePurchase = async () => {
    if (!createdPurchase) return
    const { error: e } = await db().rpc('complete_purchase_inspection', { p_purchase_id: createdPurchase.id })
    if (e) { setError(true); setMessage(e.message); return }
    setRefreshToken(v => v + 1); setError(false); setMessage('Purchase completed. Supplier outstanding is now reflected in Payments/Reports.'); setStep('payment')
  }

  const close = () => {
    setOpen(false); setItemOpen(false); setStep('entry'); setSupplierId(''); setInvoice(''); setNotes(''); setLines([blankLine()]); setDiscount('0'); setTax('0'); setDelivery('0'); setTransport('0'); setLoadingCharge('0'); setUnloadingCharge('0'); setPackingCharge('0'); setOtherCharge('0'); setCreatedPurchase(null); setReceiptLines([]); setFile(null); setPayments([blankPayment()]); setPaymentMode('later'); setMessage(''); setError(false)
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

  const paymentTotal = payments.reduce((s, p) => s + Number(p.amount || 0), 0)

  const paymentEntryFields = <>
    <h3>Payment details</h3>
    {payments.map((p, i) => <div className="purchase-line payment-line" key={i}>
      <Field label="Payment type"><select value={p.stage} onChange={e => setPayments(v => v.map((x, n) => n === i ? { ...x, stage: e.target.value } : x))}><option value="advance">Advance toward this purchase</option><option value="bill">Bill payment</option></select></Field>
      <CurrencyField label="Amount" value={p.amount} onChange={v => setPayments(x => x.map((a, n) => n === i ? { ...a, amount: v } : a))}/>
      <Field label="Actual payment date"><input type="date" value={p.date} onChange={e => setPayments(v => v.map((x, n) => n === i ? { ...x, date: e.target.value } : x))}/></Field>
      <Field label="Method"><select value={p.method} onChange={e => setPayments(v => v.map((x, n) => n === i ? { ...x, method: e.target.value } : x))}><option value="upi">UPI</option><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="other">Other</option></select></Field>
      <Field label="UPI / payment reference"><input value={p.reference} onChange={e => setPayments(v => v.map((x, n) => n === i ? { ...x, reference: e.target.value } : x))}/></Field>
      <Field label="Notes"><input value={p.notes} onChange={e => setPayments(v => v.map((x, n) => n === i ? { ...x, notes: e.target.value } : x))}/></Field>
      <button className="line-remove" type="button" onClick={() => setPayments(v => v.length === 1 ? v : v.filter((_, n) => n !== i))} disabled={payments.length === 1}>Remove</button>
    </div>)}
    <button className="add-row-button" type="button" onClick={() => setPayments(v => [...v, blankPayment()])}>＋ Add another payment</button>
    <p className="purchase-total"><strong>Total payment entered: ₹ {paymentTotal.toFixed(2)}</strong></p>
    <p className="muted">These details are captured now and linked to this Purchase after it is saved. Payment date records when the offline payment actually happened.</p>
  </>

  return <section className="page-panel">
    <div className="section-label">Mane Masala</div>
    <div className="master-header"><div><h1>Purchases</h1><p className="page-intro">Supplier bill → multiple items → receive & inspect → attach invoice/slip → complete → record payment or credit.</p></div><button className="primary-button" type="button" onClick={() => { setOpen(true); setMessage(''); setError(false) }}>+ Create Purchase</button></div>
    {open && <Modal title={step === 'entry' ? 'Create Purchase' : step === 'receipt' ? 'Receive & Inspect Purchase' : step === 'attach' ? 'Attach Invoice / Slip' : step === 'payment' ? 'Payment Details' : 'Purchase Complete'} close={close}>
      {step === 'entry' && <>
        <div className="purchase-step"><span>1</span><div><strong>Supplier and bill</strong><small>One supplier bill/slip = one Purchase. Add every item line below.</small></div></div>
        <div className="form-grid"><Field label="Supplier"><select value={supplierId} onChange={e => setSupplierId(e.target.value)}><option value="">Select supplier</option>{suppliers.map(s => <option key={txt(s.id)} value={txt(s.id)}>{txt(s.business_name)} — {txt(s.business_code)}</option>)}</select></Field><Field label="Bill date"><input type="date" value={date} onChange={e => setDate(e.target.value)} /></Field><Field label="Supplier invoice number"><input value={invoice} onChange={e => setInvoice(e.target.value)} placeholder="Optional for handwritten bill" /></Field><Field label="Source"><select value={source} onChange={e => setSource(e.target.value)}>{['whatsapp','phone','walk_in','online','other'].map(x => <option key={x} value={x}>{x.replaceAll('_',' ')}</option>)}</select></Field></div>
        <h3>Items on this bill</h3>{lines.map((l, i) => <div className="purchase-line purchase-line-v2" key={i}><Field label="Item"><select value={l.itemId} onChange={e => { if (e.target.value === '__new__') { setItemLineIndex(i); setItemOpen(true) } else updateLine(i, { itemId: e.target.value }) }}><option value="">Select item</option>{items.map(it => <option key={txt(it.id)} value={txt(it.id)}>{txt(it.item_code || it.business_code)} — {txt(it.name)}</option>)}<option value="__new__">＋ Create new Item</option></select></Field><Field label="Quantity"><input type="number" min="0" step="0.001" value={l.qty} onChange={e => updateLine(i, { qty: e.target.value })} /></Field><CurrencyField label="Rate / unit" value={l.rate} onChange={v => updateLine(i, { rate: v })} placeholder="Optional" /><div className="discount-control"><label className="field"><span>Line Discount {l.discountType === 'percent' ? '(%)' : '(₹)'}</span><div className="discount-row"><select value={l.discountType} onChange={e => updateLine(i, { discountType: e.target.value, discount: '' })}><option value="value">Value ₹</option><option value="percent">%</option></select><input type="number" min="0" step="0.01" max={l.discountType === 'percent' ? 100 : undefined} value={l.discount} onChange={e => updateLine(i, { discount: e.target.value })} placeholder={l.discountType === 'percent' ? '0–100' : '0.00'} /></div></label></div><div className="purchase-line-total"><span>Line total</span><strong>₹ {lineTotal(l).toFixed(2)}</strong></div><button className="line-remove" type="button" onClick={() => setLines(v => v.length === 1 ? v : v.filter((_, n) => n !== i))} disabled={lines.length === 1}>Remove</button></div>)}
        <button className="add-row-button" type="button" onClick={() => setLines(v => [...v, blankLine()])}>＋ Add item row</button>
        <div className="form-grid"><CurrencyField label="Bill discount (₹)" value={discount} onChange={setDiscount} /><CurrencyField label="Tax (₹)" value={tax} onChange={setTax} /><CurrencyField label="Delivery (₹)" value={delivery} onChange={setDelivery} /><CurrencyField label="Transport (₹)" value={transport} onChange={setTransport} /><CurrencyField label="Loading (₹)" value={loadingCharge} onChange={setLoadingCharge} /><CurrencyField label="Unloading (₹)" value={unloadingCharge} onChange={setUnloadingCharge} /><CurrencyField label="Packing (₹)" value={packingCharge} onChange={setPackingCharge} /><CurrencyField label="Other charges (₹)" value={otherCharge} onChange={setOtherCharge} /></div>
        <p className="purchase-total"><strong>Estimated bill total: ₹ {Math.max(0, total).toFixed(2)}</strong></p>
        <div className="purchase-payment-choice"><strong>Payment at this purchase</strong><div className="master-tabs"><button type="button" className={paymentMode==='now'?'tab-active':''} onClick={() => { setPaymentMode('now'); setMessage('Enter the actual payment details below. You can record an advance or bill payment, including multiple payments.') }}>Paid / payment entered now</button><button type="button" className={paymentMode==='later'?'tab-active':''} onClick={() => { setPaymentMode('later'); setMessage('No payment is recorded now. You can enter the offline payment later from Payments.') }}>Record payment later</button><button type="button" className={paymentMode==='credit'?'tab-active':''} onClick={() => { setPaymentMode('credit'); setMessage('Purchase remains on supplier outstanding until a payment is recorded later.') }}>Credit</button></div><small>Selecting a payment option immediately shows the applicable details or confirmation below. The actual payment transaction is linked after the Purchase is saved.</small>{paymentMode==='now' && paymentEntryFields}{paymentMode==='later' && <p className="muted">Record the purchase now and enter the actual payment later. This is for an offline transaction being recorded at a later date.</p>}{paymentMode==='credit' && <p className="muted">No payment is recorded now. The full outstanding remains due to the supplier until settled.</p>}</div>
        <Field label="Notes"><textarea value={notes} onChange={e => setNotes(e.target.value)} /></Field><Status message={message} error={error}/><div className="purchase-actions"><button className="secondary-button" type="button" onClick={close}>Cancel</button><button className="primary-button" type="button" onClick={savePurchase} disabled={saving}>{saving ? 'Saving…' : 'Save Purchase & Check Receipt'}</button></div>
      </>}
      {step === 'receipt' && <><div className="purchase-complete-banner"><strong>Purchase {txt(createdPurchase?.business_code)} saved</strong><span>Financial billed quantity remains separate from accepted physical stock.</span></div><h3>Receive and inspect</h3>{receiptLines.map((l, i) => <div className="purchase-line purchase-line-receipt" key={txt(l.id)}><div className="field"><span>Item</span><div>{txt(items.find(it => txt(it.id) === txt(l.item_id))?.item_code)} — {txt(items.find(it => txt(it.id) === txt(l.item_id))?.name)}</div></div><Field label="Billed"><input value={txt(l.billed_quantity)} readOnly /></Field><Field label="Received"><input type="number" min="0" step="0.001" value={l.received_quantity} onChange={e => setReceiptLines(v => v.map((x, n) => n === i ? { ...x, received_quantity: e.target.value } : x))}/></Field><Field label="Accepted"><input type="number" min="0" step="0.001" value={l.accepted_quantity} onChange={e => setReceiptLines(v => v.map((x, n) => n === i ? { ...x, accepted_quantity: e.target.value } : x))}/></Field><Field label="Rejected"><input type="number" min="0" step="0.001" value={l.rejected_quantity} onChange={e => setReceiptLines(v => v.map((x, n) => n === i ? { ...x, rejected_quantity: e.target.value } : x))}/></Field><Field label="Inspection notes"><input value={l.inspection_notes} onChange={e => setReceiptLines(v => v.map((x, n) => n === i ? { ...x, inspection_notes: e.target.value } : x))}/></Field></div>)}<Status message={message} error={error}/><div className="purchase-actions"><button className="secondary-button" type="button" onClick={close}>Cancel</button><button className="primary-button" type="button" onClick={recordReceipt}>Record Receipt & Inspection</button></div></>}
      {step === 'attach' && <><div className="purchase-step"><span>3</span><div><strong>Attach source document</strong><small>Keep the supplier invoice or handwritten slip linked to this purchase.</small></div></div><div className="attachment-box"><input ref={fileRef} type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv" onChange={e => setFile(e.target.files?.[0] ?? null)}/><div>{file ? <strong>{file.name}</strong> : 'Choose invoice or written slip'}</div><button className="primary-button" type="button" onClick={attach} disabled={!file}>Upload & attach</button></div><Status message={message} error={error}/><div className="purchase-actions"><button className="secondary-button" type="button" onClick={close}>Cancel</button><button className="primary-button" type="button" onClick={completePurchase}>Mark invoice inspected & complete</button></div></>}
      {step === 'payment' && <><div className="purchase-step"><span>4</span><div><strong>Payment / credit</strong><small>Record what actually happened, including an advance paid before the bill date. Payment date is the real offline payment date.</small></div></div><div className="purchase-payment-choice"><strong>How was this purchase settled?</strong><div className="master-tabs"><button type="button" className={paymentMode==='now'?'tab-active':''} onClick={() => setPaymentMode('now')}>Record payment now</button><button type="button" className={paymentMode==='later'?'tab-active':''} onClick={() => setPaymentMode('later')}>Record later</button><button type="button" className={paymentMode==='credit'?'tab-active':''} onClick={() => setPaymentMode('credit')}>Credit / unpaid</button></div></div>{paymentMode==='now'&&paymentEntryFields}{paymentMode==='later'&&<p className="muted">No payment is recorded now. The purchase can remain unpaid/credit until the actual offline payment is entered later in Payments.</p>}{paymentMode==='credit'&&<p className="muted">No payment is recorded. Supplier outstanding will remain until a later payment or correction.</p>}<Status message={message} error={error}/><div className="purchase-actions"><button className="secondary-button" type="button" onClick={close}>Cancel</button><button className="primary-button" type="button" onClick={recordPayments}>{paymentMode==='now'?'Save payment details & finish':'Finish purchase entry'}</button></div></>}
      {step === 'done' && <><div className="purchase-complete-banner"><strong>Purchase {txt(createdPurchase?.business_code)} completed</strong><span>Physical, document and financial events remain separate and auditable.</span></div><Status message={message} error={error}/><div className="purchase-actions"><button className="secondary-button" type="button" onClick={close}>Cancel</button><a className="primary-button" href="/reports">Check Report</a></div></>}
    </Modal>}
    {itemOpen && <Modal title="Create Item without leaving Purchase" close={() => setItemOpen(false)}><p className="muted">The purchase line stays intact and the new item will be selected automatically.</p><div className="form-grid"><Field label="Item name"><input autoFocus value={newName} onChange={e=>setNewName(e.target.value)}/></Field><Field label="Item type"><select value={newType} onChange={e=>setNewType(e.target.value)}><option value="raw_material">Raw material</option><option value="intermediate">Intermediate / prepared material</option><option value="finished_product">Finished product</option><option value="purchased_finished_product">Purchased finished product</option></select></Field><Field label="Category"><select value={newCategory} onChange={e=>setNewCategory(e.target.value)}><option value="">No category</option>{categories.map(c=><option key={txt(c.id)} value={txt(c.id)}>{txt(c.code)} — {txt(c.name)}</option>)}</select></Field><Field label="Unit"><select value={newUnit} onChange={e=>setNewUnit(e.target.value)}><option value="">Select unit</option>{units.map(u=><option key={txt(u.id)} value={txt(u.id)}>{txt(u.name)} ({txt(u.symbol)})</option>)}</select></Field><Field label="Minimum stock"><input type="number" min="0" step="0.001" value={newMin} onChange={e=>setNewMin(e.target.value)}/></Field></div><Status message={message} error={error}/><button className="primary-button" type="button" onClick={createItem}>Create Item</button></Modal>}
    <div className="console-panel"><div className="panel-heading"><h2>Purchases</h2></div><DataTable table="v_purchases_list" refreshToken={refreshToken}/></div>
  </section>
}
