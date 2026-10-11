'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import DataTable from '@/components/data-table'

type Row = Record<string, any>
const sb = () => createClient()
const today = () => new Date().toISOString().slice(0, 10)
const txt = (v: any) => String(v ?? '')
const n = (v: any) => Number(v || 0)
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="field"><span>{label}</span>{children}</label> }
function Status({ message, error = false }: { message: string; error?: boolean }) { return message ? <p className={`form-status${error ? ' form-status-error' : ''}`} role="alert">{message}</p> : null }
function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) { return <div className="modal-backdrop"><div className="modal-card"><div className="modal-header"><h3>{title}</h3><button className="secondary-button" type="button" onClick={close}>Cancel</button></div>{children}</div></div> }

function StockSection({ title, hint, rows, search, onSearch }: { title: string; hint: string; rows: Row[]; search: string; onSearch: (v: string) => void }) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r =>
      txt(r.name).toLowerCase().includes(q) ||
      txt(r.item_code).toLowerCase().includes(q) ||
      txt(r.business_code).toLowerCase().includes(q)
    )
  }, [rows, search])
  return (
    <div className="console-panel" style={{ marginTop: title === 'Raw materials' ? 0 : 18 }}>
      <div className="panel-heading"><h2>{title}</h2><span>{filtered.length} item{filtered.length === 1 ? '' : 's'}</span></div>
      <p className="muted" style={{ marginBottom: 8 }}>{hint}</p>
      <div className="table-toolbar" style={{ marginBottom: 8 }}>
        <input className="table-search" value={search} onChange={e => onSearch(e.target.value)} placeholder="Search by item name or code…" aria-label={`Search ${title}`} />
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Item code</th>
              <th>Item name</th>
              <th>Current stock</th>
              <th>Reserved</th>
              <th>Available</th>
              <th>Min stock</th>
            </tr>
          </thead>
          <tbody>
            {!filtered.length ? (
              <tr><td colSpan={6} className="table-message">No records found.</td></tr>
            ) : filtered.map(r => (
              <tr key={txt(r.item_id)}>
                <td>{txt(r.item_code || r.business_code)}</td>
                <td><strong>{txt(r.name)}</strong></td>
                <td>{n(r.current_stock)}</td>
                <td>{n(r.reserved_stock)}</td>
                <td>{n(r.available_stock)}</td>
                <td>{r.minimum_stock == null ? '—' : n(r.minimum_stock)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function InventoryConsoleV5() {
  const [items, setItems] = useState<Row[]>([])
  const [units, setUnits] = useState<Row[]>([])
  const [stockRows, setStockRows] = useState<Row[]>([])
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<'out' | 'adjust'>('out')
  const [itemId, setItemId] = useState('')
  const [unitId, setUnitId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('damage')
  const [notes, setNotes] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)
  const [searchRaw, setSearchRaw] = useState('')
  const [searchFinished, setSearchFinished] = useState('')
  const [searchPurchased, setSearchPurchased] = useState('')
  const [searchAll, setSearchAll] = useState('')
  const [loadingStock, setLoadingStock] = useState(true)

  async function loadMasters() {
    const client = sb()
    const [{ data: itemRows }, { data: unitRows }] = await Promise.all([
      client.from('items').select('id,item_code,business_code,name,item_type,base_unit_id,minimum_stock,is_active').eq('is_active', true).order('name'),
      client.from('units').select('*').eq('is_active', true).order('name'),
    ])
    setItems(itemRows ?? [])
    setUnits(unitRows ?? [])
  }

  async function loadStock() {
    setLoadingStock(true)
    const client = sb()
    // Prefer view when present; fall back to batches + items so UI never depends on a missing column.
    const { data: viewRows, error: viewErr } = await client.from('v_inventory_current').select('*')
    let base: Row[] = []
    if (!viewErr && viewRows) {
      base = viewRows as Row[]
    } else {
      const { data: batches } = await client.from('inventory_batches').select('item_id,quantity_remaining').eq('status', 'active')
      const byItem: Record<string, number> = {}
      for (const b of batches ?? []) {
        const id = txt(b.item_id)
        byItem[id] = (byItem[id] || 0) + n(b.quantity_remaining)
      }
      base = Object.entries(byItem).map(([item_id, current_stock]) => ({
        item_id,
        current_stock,
        reserved_stock: 0,
        available_stock: current_stock,
      }))
    }

    const { data: itemRows } = await client.from('items').select('id,item_code,business_code,name,item_type,minimum_stock,is_active').eq('is_active', true)
    const itemMap = Object.fromEntries((itemRows ?? []).map(i => [txt(i.id), i]))

    // Merge: every active item appears; stock defaults to 0
    const merged: Row[] = (itemRows ?? []).map(i => {
      const s = base.find(r => txt(r.item_id) === txt(i.id)) || {}
      return {
        item_id: txt(i.id),
        item_code: txt(i.item_code),
        business_code: txt(i.business_code),
        name: txt(i.name),
        item_type: txt(i.item_type),
        current_stock: n(s.current_stock),
        reserved_stock: n(s.reserved_stock),
        available_stock: s.available_stock != null ? n(s.available_stock) : n(s.current_stock) - n(s.reserved_stock),
        minimum_stock: i.minimum_stock,
      }
    })
    // Also include any stock rows for unknown items
    for (const s of base) {
      if (!itemMap[txt(s.item_id)]) {
        merged.push({
          item_id: txt(s.item_id),
          item_code: txt(s.business_code || s.item_code),
          business_code: txt(s.business_code),
          name: txt(s.name) || 'Unknown item',
          item_type: txt(s.item_type) || '',
          current_stock: n(s.current_stock),
          reserved_stock: n(s.reserved_stock),
          available_stock: n(s.available_stock),
          minimum_stock: s.minimum_stock,
        })
      }
    }
    setStockRows(merged)
    setLoadingStock(false)
  }

  useEffect(() => { void loadMasters() }, [])
  useEffect(() => { void loadStock() }, [refreshToken])

  const raw = useMemo(() => stockRows.filter(r => r.item_type === 'raw_material'), [stockRows])
  const finished = useMemo(() => stockRows.filter(r => r.item_type === 'finished_product'), [stockRows])
  const purchased = useMemo(() => stockRows.filter(r => r.item_type === 'purchased_finished_product'), [stockRows])

  const selectedUnit = units.find(u => txt(u.id) === unitId)
  const clearForm = () => { setItemId(''); setUnitId(''); setQuantity(''); setReason('damage'); setNotes(''); setSaving(false) }
  const closeForm = () => { setOpen(false); clearForm() }
  const openAction = () => { setMessage(''); setError(false); clearForm(); setOpen(true) }
  const chooseItem = (id: string) => { setItemId(id); const item = items.find(i => txt(i.id) === id); setUnitId(txt(item?.base_unit_id)) }
  const submit = async () => {
    if (!itemId || !unitId || Number(quantity) === 0 || !Number.isFinite(Number(quantity))) { setError(true); setMessage('Select an item and unit, then enter a non-zero quantity.'); return }
    if (kind === 'out' && Number(quantity) < 0) { setError(true); setMessage('Stock Out quantity must be greater than zero.'); return }
    setSaving(true); setMessage(''); setError(false)
    const client = sb()
    const rpc = kind === 'out' ? 'record_stock_out' : 'record_stock_adjustment'
    const payload = kind === 'out'
      ? { p_item_id: itemId, p_quantity: Number(quantity), p_unit_id: unitId, p_stock_out_date: today(), p_reason: reason, p_notes: notes || null }
      : { p_item_id: itemId, p_quantity_delta: Number(quantity), p_unit_id: unitId, p_adjustment_date: today(), p_reason: reason, p_notes: notes || null }
    const { error: e } = await client.rpc(rpc, payload)
    setSaving(false)
    if (e) { setError(true); setMessage(e.message); return }
    setRefreshToken(v => v + 1)
    closeForm()
    setError(false)
    setMessage(kind === 'out' ? 'Stock Out recorded.' : 'Stock Adjustment recorded.')
  }

  return <section className="page-panel">
    <div className="section-label">Mane Masala</div>
    <div className="master-header">
      <div>
        <h1>Inventory</h1>
        <p className="page-intro">Stock updates only after purchase <strong>Receive & inspect</strong> (Accepted qty), production output, or controlled stock actions. Reservations are commitments, not physical stock.</p>
      </div>
      <button className="primary-button" type="button" onClick={openAction}>+ Stock Action</button>
    </div>
    {open && <Modal title="Stock Action" close={closeForm}>
      <div className="master-tabs">
        <button type="button" className={kind === 'out' ? 'tab-active' : ''} onClick={() => { setKind('out'); setReason('damage') }}>Stock Out</button>
        <button type="button" className={kind === 'adjust' ? 'tab-active' : ''} onClick={() => setKind('adjust')}>Stock Adjustment</button>
      </div>
      <div className="form-grid">
        <Field label="Item"><select value={itemId} onChange={e => chooseItem(e.target.value)}><option value="">Select item</option>{items.map(i => <option key={txt(i.id)} value={txt(i.id)}>{txt(i.item_code)} — {txt(i.name)}</option>)}</select></Field>
        <Field label="Unit of measure"><select value={unitId} disabled={!itemId} onChange={e => setUnitId(e.target.value)}><option value="">Select item first</option>{units.map(u => <option key={txt(u.id)} value={txt(u.id)}>{txt(u.name)} ({txt(u.symbol)})</option>)}</select></Field>
        <Field label={kind === 'out' ? 'Quantity' : 'Adjustment (+ adds / − removes)'}><input type="number" step="0.001" value={quantity} onChange={e => setQuantity(e.target.value)} /></Field>
        <Field label="Reason"><select value={reason} onChange={e => setReason(e.target.value)}><option value="damage">Damage</option><option value="expiry">Expiry</option><option value="sample">Sample</option><option value="wastage">Wastage</option><option value="personal_use">Personal use</option><option value="other">Other</option></select></Field>
      </div>
      {itemId && <div className="unit-standard-note"><strong>Standard unit:</strong> {txt(selectedUnit?.name)} ({txt(selectedUnit?.symbol)}).</div>}
      <Field label="Notes"><textarea value={notes} onChange={e => setNotes(e.target.value)} /></Field>
      <Status message={message} error={error} />
      <div className="purchase-actions">
        <button className="secondary-button" type="button" onClick={closeForm}>Cancel</button>
        <button className="primary-button" type="button" onClick={submit} disabled={saving}>{saving ? 'Recording…' : 'Record Stock Action'}</button>
      </div>
    </Modal>}
    <Status message={!open ? message : ''} error={error} />
    {loadingStock && <p className="muted">Loading stock…</p>}

    <StockSection title="Raw materials" hint="Purchased ingredients used in production. Stock increases when a purchase is received (Accepted qty)." rows={raw} search={searchRaw} onSearch={setSearchRaw} />
    <StockSection title="Finished products" hint="In-house manufactured sellable goods. Stock increases from production output." rows={finished} search={searchFinished} onSearch={setSearchFinished} />
    <StockSection title="Purchased finished goods" hint="Finished goods bought for resale. Stock increases when the purchase is received (Accepted qty)." rows={purchased} search={searchPurchased} onSearch={setSearchPurchased} />
    <StockSection title="All stock (combined)" hint="Every active item and its current stock position." rows={stockRows} search={searchAll} onSearch={setSearchAll} />

    <div className="console-panel" style={{ marginTop: 18 }}>
      <div className="panel-heading"><h2>Inventory movements</h2></div>
      <DataTable table="inventory_transactions" refreshToken={refreshToken} />
    </div>
  </section>
}
