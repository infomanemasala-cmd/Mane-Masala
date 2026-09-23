'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Row = Record<string, any>

export default function ItemMasterPanel({ archived = false, refreshToken = 0 }: { archived?: boolean; refreshToken?: number }) {
  const [rows, setRows] = useState<Row[]>([])
  const [units, setUnits] = useState<Row[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [editing, setEditing] = useState<Row | null>(null)
  const [showArchived, setShowArchived] = useState(archived)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    const sb = createClient()
    const [{ data, error: e }, { data: unitRows }] = await Promise.all([
      sb.from('items').select('*').eq('is_active', !showArchived).order('item_code'),
      sb.from('units').select('id,name,symbol').eq('is_active', true).order('name'),
    ])
    if (e) setError(e.message)
    else { setRows(data ?? []); setUnits(unitRows ?? []) }
  }

  useEffect(() => { setSelected([]); void load() }, [showArchived, refreshToken])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return rows
    return rows.filter(row => [row.item_code, row.business_code, row.name, row.item_type, row.subcategory, row.notes].some(value => String(value ?? '').toLowerCase().includes(term)))
  }, [rows, search])

  const toggle = (id: string) => setSelected(current => current.includes(id) ? current.filter(x => x !== id) : [...current, id])

  const archive = async () => {
    if (!selected.length) return
    if (!window.confirm('Archive the selected item(s)? They will remain available for history and can be restored when safe.')) return
    setBusy(true); setMessage(''); setError('')
    const { error: e } = await createClient().rpc('archive_master_items', { p_item_ids: selected, p_reason: 'Archived from Master Data' })
    if (e) setError(e.message)
    else { setMessage(`${selected.length} item(s) archived.`); setSelected([]); await load() }
    setBusy(false)
  }

  const restore = async () => {
    if (!selected.length) return
    if (!window.confirm(`Restore ${selected.length} archived item(s)?`)) return
    setBusy(true); setMessage(''); setError('')
    const { error: e } = await createClient().rpc('restore_master_items', { p_item_ids: selected })
    if (e) setError(e.message)
    else { setMessage(`${selected.length} item(s) restored.`); setSelected([]); await load() }
    setBusy(false)
  }

  const save = async (payload: Record<string, unknown>) => {
    if (!editing) return
    setBusy(true); setMessage(''); setError('')
    const { error: e } = await createClient().rpc('update_master_item_safe', { p_item_id: String(editing.id), ...payload })
    if (e) setError(e.message)
    else { setMessage('Master item updated successfully.'); setEditing(null); await load() }
    setBusy(false)
  }

  return <div className="master-item-panel">
    <div className="master-list-toolbar">
      <div>
        <button className={!showArchived ? 'secondary-button tab-active' : 'secondary-button'} type="button" onClick={() => setShowArchived(false)}>Active records</button>
        <button className={showArchived ? 'secondary-button tab-active' : 'secondary-button'} type="button" onClick={() => setShowArchived(true)}>Archived records</button>
      </div>
      <button className="secondary-button" type="button" disabled={busy || !selected.length} onClick={() => void (showArchived ? restore() : archive())}>{showArchived ? 'Restore selected' : 'Archive selected'}</button>
    </div>
    <div className="table-toolbar"><input className="table-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search code or name…" aria-label="Search items" /><span className="table-count">{visible.length} record{visible.length === 1 ? '' : 's'}</span></div>
    {message && <p className="form-status form-status-success">{message}</p>}
    {error && <p className="form-status form-status-error">{error}</p>}
    <div className="table-wrap"><table><thead><tr><th>Select</th><th>Code</th><th>Name</th><th>Type</th><th>Unit</th><th>Status</th><th>Edit</th></tr></thead><tbody>
      {visible.length === 0 ? <tr><td colSpan={7} className="table-message">No records found.</td></tr> : visible.map(row => <tr key={String(row.id)}>
        <td><input type="checkbox" checked={selected.includes(String(row.id))} onChange={() => toggle(String(row.id))} aria-label={`Select ${String(row.name)}`} /></td>
        <td><strong>{String(row.item_code)}</strong></td>
        <td>{String(row.name)}</td>
        <td>{String(row.item_type)}</td>
        <td>{(() => { const unit = units.find(item => String(item.id) === String(row.base_unit_id)); return unit ? `${String(unit.name)} (${String(unit.symbol)})` : '' })()}</td>
        <td>{showArchived ? 'Archived' : 'Active'}</td>
        <td><button className="secondary-button" type="button" onClick={() => setEditing(row)}>Edit</button></td>
      </tr>)}
    </tbody></table></div>
    {editing && <ItemEditModal row={editing} onClose={() => setEditing(null)} onSave={save} busy={busy} />}
  </div>
}

function ItemEditModal({ row, onClose, onSave, busy }: { row: Row; onClose: () => void; onSave: (payload: Record<string, unknown>) => Promise<void>; busy: boolean }) {
  const [units, setUnits] = useState<Row[]>([])
  const [categories, setCategories] = useState<Row[]>([])
  const [name, setName] = useState(String(row.name ?? ''))
  const [categoryId, setCategoryId] = useState(String(row.category_id ?? ''))
  const [subcategory, setSubcategory] = useState(String(row.subcategory ?? ''))
  const [productFamily, setProductFamily] = useState(String(row.product_family ?? ''))
  const [purchaseUnit, setPurchaseUnit] = useState(String(row.purchase_unit_id ?? ''))
  const [baseUnit, setBaseUnit] = useState(String(row.base_unit_id ?? ''))
  const [sellingUnit, setSellingUnit] = useState(String(row.selling_unit_id ?? ''))
  const [minimumStock, setMinimumStock] = useState(String(row.minimum_stock ?? '0'))
  const [canBeSold, setCanBeSold] = useState(Boolean(row.can_be_sold))
  const [canBeUsed, setCanBeUsed] = useState(Boolean(row.can_be_used_in_production))
  const [isIntermediate, setIsIntermediate] = useState(Boolean(row.is_intermediate))
  const [isPerishable, setIsPerishable] = useState(Boolean(row.is_perishable))
  const [expiryTracking, setExpiryTracking] = useState(Boolean(row.expiry_tracking_enabled))
  const [expiryValue, setExpiryValue] = useState(String(row.expiry_duration_value ?? ''))
  const [expiryUnit, setExpiryUnit] = useState(String(row.expiry_duration_unit ?? 'months'))
  const [notes, setNotes] = useState(String(row.notes ?? ''))

  useEffect(() => {
    const sb = createClient()
    void Promise.all([
      sb.from('units').select('id,name,symbol').eq('is_active', true).order('name'),
      sb.from('categories').select('id,code,name').eq('is_active', true).order('name'),
    ]).then(([u, c]) => { setUnits(u.data ?? []); setCategories(c.data ?? []) })
  }, [])

  const submit = async () => {
    await onSave({
      p_name: name.trim(),
      p_category_id: categoryId || null,
      p_subcategory: subcategory.trim() || null,
      p_product_family: productFamily.trim() || null,
      p_purchase_unit_id: purchaseUnit || null,
      p_base_unit_id: baseUnit || null,
      p_selling_unit_id: sellingUnit || null,
      p_minimum_stock: Number(minimumStock || 0),
      p_can_be_sold: canBeSold,
      p_can_be_used_in_production: canBeUsed,
      p_is_intermediate: isIntermediate,
      p_is_perishable: isPerishable,
      p_expiry_tracking_enabled: expiryTracking,
      p_expiry_duration_value: expiryTracking && expiryValue ? Number(expiryValue) : null,
      p_expiry_duration_unit: expiryTracking ? expiryUnit : null,
      p_notes: notes.trim() || null,
    })
  }

  return <div className="modal-backdrop" role="presentation">
    <div className="modal-card" role="dialog" aria-modal="true" aria-label={`Edit ${String(row.name)}`}>
      <div className="modal-header"><div><h3>Edit {String(row.item_code)} — {String(row.name)}</h3><p className="muted">Permanent business code is immutable.</p></div><button className="secondary-button" type="button" onClick={onClose} disabled={busy}>Close</button></div>
      <div className="form-grid">
        <label className="form-field"><span>Name</span><input value={name} onChange={e => setName(e.target.value)} /></label>
        <label className="form-field"><span>Category</span><select value={categoryId} onChange={e => setCategoryId(e.target.value)}><option value="">No category</option>{categories.map(c => <option key={String(c.id)} value={String(c.id)}>{String(c.code)} — {String(c.name)}</option>)}</select></label>
        <label className="form-field"><span>Subcategory</span><input value={subcategory} onChange={e => setSubcategory(e.target.value)} /></label>
        <label className="form-field"><span>Product family</span><input value={productFamily} onChange={e => setProductFamily(e.target.value)} /></label>
        <label className="form-field"><span>Purchase unit</span><select value={purchaseUnit} onChange={e => setPurchaseUnit(e.target.value)}>{units.map(u => <option key={String(u.id)} value={String(u.id)}>{String(u.name)} ({String(u.symbol)})</option>)}</select></label>
        <label className="form-field"><span>Base unit</span><select value={baseUnit} onChange={e => setBaseUnit(e.target.value)}>{units.map(u => <option key={String(u.id)} value={String(u.id)}>{String(u.name)} ({String(u.symbol)})</option>)}</select></label>
        <label className="form-field"><span>Selling unit</span><select value={sellingUnit} onChange={e => setSellingUnit(e.target.value)}><option value="">Not specified</option>{units.map(u => <option key={String(u.id)} value={String(u.id)}>{String(u.name)} ({String(u.symbol)})</option>)}</select></label>
        <label className="form-field"><span>Minimum stock</span><input type="number" min="0" step="0.001" value={minimumStock} onChange={e => setMinimumStock(e.target.value)} /></label>
      </div>
      <div className="form-checks">
        <label><input type="checkbox" checked={canBeSold} onChange={e => setCanBeSold(e.target.checked)} /> Can be sold directly</label>
        <label><input type="checkbox" checked={canBeUsed} onChange={e => setCanBeUsed(e.target.checked)} /> Can be used in production</label>
        <label><input type="checkbox" checked={isIntermediate} onChange={e => setIsIntermediate(e.target.checked)} /> Intermediate / prepared material</label>
        <label><input type="checkbox" checked={isPerishable} onChange={e => setIsPerishable(e.target.checked)} /> Perishable</label>
        <label><input type="checkbox" checked={expiryTracking} onChange={e => setExpiryTracking(e.target.checked)} /> Track expiry</label>
      </div>
      {expiryTracking && <div className="form-grid"><label className="form-field"><span>Expiry duration</span><input type="number" min="0.01" step="0.01" value={expiryValue} onChange={e => setExpiryValue(e.target.value)} /></label><label className="form-field"><span>Duration unit</span><select value={expiryUnit} onChange={e => setExpiryUnit(e.target.value)}><option value="days">Days</option><option value="months">Months</option><option value="years">Years</option></select></label></div>}
      <label className="form-field"><span>Notes / package details</span><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} /></label>
      <div className="purchase-actions"><button className="secondary-button" type="button" onClick={onClose} disabled={busy}>Cancel</button><button className="primary-button" type="button" onClick={() => void submit()} disabled={busy || !name.trim()}>{busy ? 'Saving…' : 'Save changes'}</button></div>
    </div>
  </div>
}
