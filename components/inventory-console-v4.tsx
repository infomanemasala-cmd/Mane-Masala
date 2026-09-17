'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import DataTable from '@/components/data-table'

type Row = Record<string, any>
const sb = () => createClient()
const today = () => new Date().toISOString().slice(0, 10)
const txt = (v: any) => String(v ?? '')
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="field"><span>{label}</span>{children}</label> }
function Status({ message, error = false }: { message: string; error?: boolean }) { return message ? <p className={`form-status${error ? ' form-status-error' : ''}`} role="alert">{message}</p> : null }
function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) { return <div className="modal-backdrop"><div className="modal-card"><div className="modal-header"><h3>{title}</h3><button className="secondary-button" type="button" onClick={close}>Cancel</button></div>{children}</div></div> }

export default function InventoryConsoleV4() {
  const [items, setItems] = useState<Row[]>([]), [units, setUnits] = useState<Row[]>([])
  const [open, setOpen] = useState(false), [kind, setKind] = useState<'out' | 'adjust'>('out')
  const [itemId, setItemId] = useState(''), [unitId, setUnitId] = useState(''), [quantity, setQuantity] = useState(''), [reason, setReason] = useState('damage'), [notes, setNotes] = useState('')
  const [message, setMessage] = useState(''), [error, setError] = useState(false), [saving, setSaving] = useState(false), [refreshToken, setRefreshToken] = useState(0)
  async function load() { const client = sb(); const [{ data: itemRows }, { data: unitRows }] = await Promise.all([client.from('items').select('*').eq('is_active', true).order('name'), client.from('units').select('*').eq('is_active', true).order('name')]); setItems(itemRows ?? []); setUnits(unitRows ?? []) }
  useEffect(() => { void load() }, [])
  const selectedUnit = units.find(u => txt(u.id) === unitId)
  const clearForm = () => { setItemId(''); setUnitId(''); setQuantity(''); setReason('damage'); setNotes(''); setSaving(false) }
  const closeForm = () => { setOpen(false); clearForm() }
  const openAction = () => { setMessage(''); setError(false); clearForm(); setOpen(true) }
  const chooseItem = (id: string) => { setItemId(id); const item = items.find(i => txt(i.id) === id); setUnitId(txt(item?.base_unit_id)) }
  const submit = async () => {
    if (!itemId || !unitId || Number(quantity) === 0 || !Number.isFinite(Number(quantity))) { setError(true); setMessage('Select an item and unit, then enter a non-zero quantity.'); return }
    if (kind === 'out' && Number(quantity) < 0) { setError(true); setMessage('Stock Out quantity must be greater than zero.'); return }
    setSaving(true); setMessage(''); setError(false)
    const client = sb(); const rpc = kind === 'out' ? 'record_stock_out' : 'record_stock_adjustment'
    const payload = kind === 'out' ? { p_item_id: itemId, p_quantity: Number(quantity), p_unit_id: unitId, p_stock_out_date: today(), p_reason: reason, p_notes: notes || null } : { p_item_id: itemId, p_quantity_delta: Number(quantity), p_unit_id: unitId, p_adjustment_date: today(), p_reason: reason, p_notes: notes || null }
    const { error: e } = await client.rpc(rpc, payload); setSaving(false)
    if (e) { setError(true); setMessage(e.message); return }
    setError(false); setMessage(kind === 'out' ? 'Stock Out recorded.' : 'Stock Adjustment recorded.'); setRefreshToken(v => v + 1); closeForm()
  }
  return <section className="page-panel">
    <div className="section-label">Mane Masala</div>
    <div className="master-header"><div><h1>Inventory</h1><p className="page-intro">Current stock comes from inventory transactions. Reservations are commitments; physical stock changes only through controlled movements.</p></div><button className="primary-button" type="button" onClick={openAction}>+ Stock Action</button></div>
    {open && <Modal title="Stock Action" close={closeForm}><div className="master-tabs"><button type="button" className={kind === 'out' ? 'tab-active' : ''} onClick={() => { setKind('out'); setReason('damage') }}>Stock Out</button><button type="button" className={kind === 'adjust' ? 'tab-active' : ''} onClick={() => setKind('adjust')}>Stock Adjustment</button></div><div className="form-grid"><Field label="Item"><select value={itemId} onChange={e => chooseItem(e.target.value)}><option value="">Select item</option>{items.map(i => <option key={txt(i.id)} value={txt(i.id)}>{txt(i.item_code)} — {txt(i.name)}</option>)}</select></Field><Field label="Unit of measure"><select value={unitId} disabled={!itemId} onChange={e => setUnitId(e.target.value)}><option value="">Select item first</option>{units.map(u => <option key={txt(u.id)} value={txt(u.id)}>{txt(u.name)} ({txt(u.symbol)})</option>)}</select></Field><Field label={kind === 'out' ? 'Quantity' : 'Adjustment (+ adds / − removes)'}><input type="number" step="0.001" value={quantity} onChange={e => setQuantity(e.target.value)} /></Field><Field label="Reason"><select value={reason} onChange={e => setReason(e.target.value)}><option value="damage">Damage</option><option value="expiry">Expiry</option><option value="sample">Sample</option><option value="wastage">Wastage</option><option value="personal_use">Personal use</option><option value="other">Other</option></select></Field></div>{itemId && <div className="unit-standard-note"><strong>Standard unit:</strong> {txt(selectedUnit?.name)} ({txt(selectedUnit?.symbol)}). This is taken from the item&apos;s defined base unit and is used for the stock movement.</div>}<Field label="Notes"><textarea value={notes} onChange={e => setNotes(e.target.value)} /></Field><Status message={message} error={error} /><div className="purchase-actions"><button className="secondary-button" type="button" onClick={closeForm}>Cancel</button><button className="primary-button" type="button" onClick={submit} disabled={saving}>{saving ? 'Recording…' : 'Record Stock Action'}</button></div></Modal>}
    <Status message={!open ? message : ''} error={error} />
    <div className="console-panel"><div className="panel-heading"><h2>Current stock</h2></div><DataTable table="v_inventory_current" refreshToken={refreshToken} /></div>
    <div className="console-panel" style={{ marginTop: 18 }}><div className="panel-heading"><h2>Inventory movements</h2></div><DataTable table="inventory_transactions" refreshToken={refreshToken} /></div>
  </section>
}
