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

export default function InventoryConsoleV2() {
  const [items, setItems] = useState<Row[]>([])
  const [units, setUnits] = useState<Row[]>([])
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<'out' | 'adjust'>('out')
  const [itemId, setItemId] = useState('')
  const [unitId, setUnitId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('damage')
  const [productionItemId, setProductionItemId] = useState('')
  const [notes, setNotes] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)

  async function load() {
    const client = sb()
    const [{ data: itemRows }, { data: unitRows }] = await Promise.all([
      client.from('items').select('*').eq('is_active', true).order('name'),
      client.from('units').select('*').eq('is_active', true).order('name'),
    ])
    setItems(itemRows ?? []); setUnits(unitRows ?? [])
  }
  useEffect(() => { void load() }, [])

  const selectedItem = items.find(i => txt(i.id) === itemId)
  const selectedUnit = units.find(u => txt(u.id) === unitId)
  const reset = () => { setOpen(false); setItemId(''); setUnitId(''); setQuantity(''); setReason('damage'); setProductionItemId(''); setNotes(''); setMessage(''); setError(false) }
  const chooseItem = (id: string) => { setItemId(id); const item = items.find(i => txt(i.id) === id); setUnitId(txt(item?.base_unit_id)); }
  const openAction = () => { setOpen(true); setMessage(''); setError(false) }
  const submit = async () => {
    if (!itemId || !unitId || Number(quantity) <= 0) { setError(true); setMessage('Select an item and unit, then enter a quantity greater than zero.'); return }
    setSaving(true); setMessage(''); setError(false)
    const client = sb()
    const rpc = kind === 'out' ? 'record_stock_out' : 'record_stock_adjustment'
    const payload = kind === 'out'
      ? { p_item_id: itemId, p_quantity: Number(quantity), p_unit_id: unitId, p_reason: reason, p_notes: notes || null }
      : { p_item_id: itemId, p_quantity: Number(quantity), p_unit_id: unitId, p_reason: reason, p_notes: notes || null }
    const { error: e } = await client.rpc(rpc, payload)
    setSaving(false)
    if (e) { setError(true); setMessage(e.message); return }
    setError(false); setMessage(kind === 'out' ? 'Stock Out recorded.' : 'Stock Adjustment recorded.'); setRefreshToken(v => v + 1); reset()
  }

  return <section className="page-panel">
    <div className="section-label">Mane Masala</div>
    <div className="master-header"><div><h1>Inventory</h1><p className="page-intro">Current stock comes from inventory transactions. Reservations are commitments; physical stock changes only through controlled movements.</p></div><button className="primary-button" type="button" onClick={openAction}>+ Stock Action</button></div>
    {open && <Modal title="Stock Action" close={reset}>
      <div className="master-tabs"><button type="button" className={kind==='out'?'tab-active':''} onClick={()=>{setKind('out');setReason('damage')}}>Stock Out</button><button type="button" className={kind==='adjust'?'tab-active':''} onClick={()=>setKind('adjust')}>Stock Adjustment</button></div>
      <div className="form-grid">
        <Field label="Item"><select value={itemId} onChange={e=>chooseItem(e.target.value)}><option value="">Select item</option>{items.map(i=><option key={txt(i.id)} value={txt(i.id)}>{txt(i.item_code)} — {txt(i.name)}</option>)}</select></Field>
        <Field label="Unit of measure"><select value={unitId} disabled={!itemId} onChange={e=>setUnitId(e.target.value)}><option value="">Select item first</option>{units.map(u=><option key={txt(u.id)} value={txt(u.id)}>{txt(u.name)} ({txt(u.symbol)})</option>)}</select></Field>
        <Field label={kind==='out'?'Quantity':'Adjustment (+ adds / − removes)'}><input type="number" step="0.001" value={quantity} onChange={e=>setQuantity(e.target.value)}/></Field>
        <Field label="Reason"><select value={reason} onChange={e=>{setReason(e.target.value);if(e.target.value==='production'&&!productionItemId)setProductionItemId(itemId)}}><option value="damage">Damage</option><option value="expiry">Expiry</option><option value="sample">Sample</option><option value="wastage">Wastage</option><option value="personal_use">Personal use</option><option value="production">Production</option><option value="correction">Adjustment</option><option value="other">Other</option></select></Field>
      </div>
      {itemId && <div className="unit-standard-note"><strong>Standard unit:</strong> {txt(selectedUnit?.name)} ({txt(selectedUnit?.symbol)}). This is taken from the item&apos;s defined base unit and is used for the stock movement.</div>}
      {reason==='production' && <div className="production-linked-box"><Field label="Production item"><select value={productionItemId} onChange={e=>setProductionItemId(e.target.value)}><option value="">Select production item</option>{items.filter(i=>i.is_active !== false).map(i=><option key={txt(i.id)} value={txt(i.id)}>{txt(i.item_code)} — {txt(i.name)}</option>)}</select></Field><p className="muted">Production reason selected: choose the item this movement belongs to. The list is always taken from the Item master.</p></div>}
      <Field label="Notes"><textarea value={notes} onChange={e=>setNotes(e.target.value)}/></Field><Status message={message} error={error}/><div className="purchase-actions"><button className="secondary-button" type="button" onClick={reset}>Cancel</button><button className="primary-button" type="button" onClick={submit} disabled={saving}>{saving?'Recording…':'Record Stock Action'}</button></div>
    </Modal>}
    <div className="console-panel"><div className="panel-heading"><h2>Current stock</h2></div><DataTable table="v_inventory_current" refreshToken={refreshToken}/></div>
    <div className="console-panel" style={{marginTop:18}}><div className="panel-heading"><h2>Inventory movements</h2></div><DataTable table="inventory_transactions" refreshToken={refreshToken}/></div>
  </section>
}
