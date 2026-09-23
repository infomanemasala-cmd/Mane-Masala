'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import SearchableSelect from '@/components/searchable-select'

type Row = Record<string, any>
const db = () => createClient()
const txt = (v: any) => String(v ?? '')

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="form-field"><span>{label}</span>{children}</label> }

function packageFields(notes: string) {
  const packageMatch = notes.match(/Package:\s*([^|\n]+)/i)
  const sizeMatch = notes.match(/Minimum package\/sale size:\s*([^|\n]+)/i)
  return { packageType: packageMatch?.[1]?.trim() ?? '', packageSize: sizeMatch?.[1]?.trim() ?? '' }
}

function mergePackageNotes(existing: string, packageType: string, packageSize: string) {
  const rest = existing.replace(/\n?Product:\s*[^|\n]+\s*\|\s*/i, '\n').replace(/Package:\s*[^|\n]+\s*\|\s*/i, '').replace(/Minimum package\/sale size:\s*[^|\n]+/i, '').replace(/\n{2,}/g, '\n').trim()
  const productLine = `Package: ${packageType.trim() || 'Not specified'} | Minimum package/sale size: ${packageSize.trim() || 'Not specified'}`
  return rest ? `${rest}\n${productLine}` : productLine
}

export default function MasterItemManager() {
  const [rows, setRows] = useState<Row[]>([]), [search, setSearch] = useState(''), [showArchived, setShowArchived] = useState(false)
  const [selected, setSelected] = useState<string[]>([]), [editing, setEditing] = useState<Row | null>(null), [pendingArchive, setPendingArchive] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [units, setUnits] = useState<Row[]>([]), [categories, setCategories] = useState<Row[]>([]), [types, setTypes] = useState<Row[]>([])
  const [name, setName] = useState(''), [itemType, setItemType] = useState(''), [categoryId, setCategoryId] = useState(''), [subcategory, setSubcategory] = useState(''), [productFamily, setProductFamily] = useState(''), [purchaseUnitId, setPurchaseUnitId] = useState(''), [baseUnitId, setBaseUnitId] = useState(''), [sellingUnitId, setSellingUnitId] = useState(''), [minimumStock, setMinimumStock] = useState('0'), [canBeSold, setCanBeSold] = useState(false), [canBeUsed, setCanBeUsed] = useState(false), [isIntermediate, setIsIntermediate] = useState(false), [notes, setNotes] = useState(''), [packageType, setPackageType] = useState(''), [packageSize, setPackageSize] = useState('')

  const load = async () => {
    const [{ data: itemRows, error: itemError }, { data: unitRows }, { data: categoryRows }, { data: typeRows }] = await Promise.all([
      db().from('items').select('*').order('item_code'), db().from('units').select('id,name,symbol,code').eq('is_active', true).order('name'), db().from('categories').select('id,name,code').eq('is_active', true).order('name'), db().from('item_types').select('id,name,code').eq('is_active', true).order('name')
    ])
    if (itemError) setError(itemError.message)
    setRows(itemRows ?? []); setUnits(unitRows ?? []); setCategories(categoryRows ?? []); setTypes(typeRows ?? [])
  }
  useEffect(() => { void load() }, [])

  const filtered = useMemo(() => { const q = search.trim().toLocaleLowerCase(); if (!q) return rows.filter(r => showArchived ? !r.is_active : r.is_active); return rows.filter(r => (showArchived ? !r.is_active : r.is_active) && `${txt(r.item_code)} ${txt(r.business_code)} ${txt(r.name)} ${txt(r.item_type)}`.toLocaleLowerCase().includes(q)) }, [rows, search, showArchived])

  const openEdit = (row: Row) => {
    const p = packageFields(txt(row.notes)); setEditing(row); setName(txt(row.name)); setItemType(txt(row.item_type)); setCategoryId(txt(row.category_id)); setSubcategory(txt(row.subcategory)); setProductFamily(txt(row.product_family)); setPurchaseUnitId(txt(row.purchase_unit_id)); setBaseUnitId(txt(row.base_unit_id)); setSellingUnitId(txt(row.selling_unit_id)); setMinimumStock(txt(row.minimum_stock)); setCanBeSold(Boolean(row.can_be_sold)); setCanBeUsed(Boolean(row.can_be_used_in_production)); setIsIntermediate(Boolean(row.is_intermediate)); setNotes(txt(row.notes)); setPackageType(p.packageType); setPackageSize(p.packageSize); setMessage(''); setError('')
  }
  const closeEdit = () => setEditing(null)
  const save = async () => {
    if (!editing) return; setBusy(true); setMessage(''); setError('')
    const { error: e } = await db().rpc('update_master_item', { p_item_id: editing.id, p_name: name.trim(), p_item_type: itemType, p_category_id: categoryId || null, p_subcategory: subcategory.trim() || null, p_product_family: productFamily.trim() || null, p_purchase_unit_id: purchaseUnitId || null, p_base_unit_id: baseUnitId, p_selling_unit_id: sellingUnitId || null, p_minimum_stock: Number(minimumStock || 0), p_can_be_sold: canBeSold, p_can_be_used_in_production: canBeUsed, p_is_intermediate: isIntermediate, p_is_perishable: Boolean(editing.is_perishable), p_expiry_tracking_enabled: Boolean(editing.expiry_tracking_enabled), p_expiry_duration_value: editing.expiry_duration_value ?? null, p_expiry_duration_unit: editing.expiry_duration_unit ?? null, p_notes: packageType || packageSize ? mergePackageNotes(notes, packageType, packageSize) : notes.trim() || null })
    setBusy(false); if (e) { setError(e.message); return } setMessage('Saved. Permanent code was not changed.'); closeEdit(); await load()
  }
  const archive = async () => {
    if (!selected.length) return
    setBusy(true); setMessage(''); setError('')
    for (const id of selected) { const { error: e } = await db().rpc('archive_master_record', { p_table: 'items', p_id: id, p_reason: 'Archived from Master Data' }); if (e) { setError(e.message); setBusy(false); setPendingArchive(false); return } }
    setSelected([]); setBusy(false); setPendingArchive(false); setMessage('Archived successfully.'); await load()
  }
  const restore = async (id: string) => { if (!window.confirm('Restore this record to the active list?')) return; setBusy(true); setMessage(''); setError(''); const { error: e } = await db().rpc('restore_master_record', { p_table: 'items', p_id: id }); setBusy(false); if (e) { setError(e.message); return } setMessage('Restored successfully.'); await load() }
  const unitLabel = (id: string) => { const u = units.find(x => txt(x.id) === id); return u ? `${txt(u.name)} (${txt(u.symbol)})` : '' }

  return <div className="master-manager">
    <div className="master-header"><div><h2>Item Master</h2><p>Search, edit, archive and restore materials and products. Permanent codes stay unchanged.</p></div><div className="table-toolbar-right"><button className={showArchived ? 'secondary-button tab-active' : 'secondary-button'} type="button" onClick={() => { setShowArchived(v => !v); setSelected([]) }}>{showArchived ? 'Active Records' : 'Archived Records'}</button><button className="secondary-button" type="button" disabled={!selected.length || showArchived || busy} onClick={() => setPendingArchive(true)}>Archive{selected.length ? ` (${selected.length})` : ''}</button></div></div>
    <div className="data-table"><div className="table-toolbar"><input className="table-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search code or name…" aria-label="Search items by code or name"/><span className="table-count">{filtered.length} record{filtered.length === 1 ? '' : 's'}</span></div><div className="table-wrap"><table><thead><tr>{!showArchived && <th><input type="checkbox" aria-label="Select all visible items" checked={filtered.length > 0 && filtered.every(r => selected.includes(txt(r.id)))} onChange={e => setSelected(e.target.checked ? filtered.map(r => txt(r.id)) : [])}/></th>}<th>Code</th><th>Name</th><th>Type</th><th>Unit</th><th>Status</th><th>Action</th></tr></thead><tbody>{filtered.map(row => <tr key={txt(row.id)}>{!showArchived && <td><input type="checkbox" checked={selected.includes(txt(row.id))} onChange={e => setSelected(v => e.target.checked ? [...new Set([...v,txt(row.id)])] : v.filter(id => id !== txt(row.id)))} aria-label={`Select ${txt(row.name)}`}/></td>}<td>{txt(row.item_code || row.business_code)}</td><td>{txt(row.name)}</td><td>{txt(row.item_type)}</td><td>{unitLabel(txt(row.base_unit_id))}</td><td>{row.is_active ? 'Active' : 'Archived'}</td><td>{showArchived ? <button className="secondary-button" type="button" onClick={() => void restore(txt(row.id))} disabled={busy}>Restore</button> : <button className="secondary-button" type="button" onClick={() => openEdit(row)}>Edit</button>}</td></tr>)}{!filtered.length && <tr><td colSpan={showArchived ? 7 : 8} className="table-message">No records found.</td></tr>}</tbody></table></div></div>
    {message && <p className="form-status form-status-success">{message}</p>}{error && <p className="form-status form-status-error">{error}</p>}{pendingArchive && <div className="modal-backdrop" role="presentation"><div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="archive-item-title"><div className="modal-header"><h3 id="archive-item-title">Archive selected items?</h3><button className="secondary-button" type="button" onClick={() => setPendingArchive(false)} disabled={busy}>Cancel</button></div><p className="muted">{selected.length} selected record{selected.length === 1 ? '' : 's'} will leave the active list but remain in history. Records with active reservations or active recipe dependencies will be blocked safely.</p><div className="purchase-actions"><button className="secondary-button" type="button" onClick={() => setPendingArchive(false)} disabled={busy}>Cancel</button><button className="primary-button" type="button" onClick={() => void archive()} disabled={busy}>{busy ? 'Archiving…' : 'Confirm Archive'}</button></div></div></div>}
    {editing && <div className="modal-backdrop"><div className="modal-card purchase-modal"><div className="modal-header"><div><h3>Edit {txt(editing.item_code || editing.business_code)} — {txt(editing.name)}</h3><p className="muted">Permanent business code cannot be changed. Base-unit changes are controlled and must be handled through the safe unit workflow.</p></div><button className="secondary-button" type="button" onClick={closeEdit} disabled={busy}>Close</button></div><div className="form-grid">
      <Field label="Name"><input value={name} onChange={e => setName(e.target.value)}/></Field>
      <Field label="Item type"><SearchableSelect value={itemType} options={types.map(t => ({value:txt(t.code),label:txt(t.name),code:txt(t.code),name:txt(t.name)}))} onChange={setItemType} placeholder="Select item type"/></Field>
      <Field label="Category"><SearchableSelect value={categoryId} options={categories.map(c => ({value:txt(c.id),label:`${txt(c.code)} — ${txt(c.name)}`,code:txt(c.code),name:txt(c.name)}))} onChange={setCategoryId} placeholder="Select category"/></Field>
      <Field label="Subcategory"><input value={subcategory} onChange={e => setSubcategory(e.target.value)}/></Field>
      <Field label="Product family"><input value={productFamily} onChange={e => setProductFamily(e.target.value)}/></Field>
      <Field label="Purchase unit"><SearchableSelect value={purchaseUnitId} options={units.map(u => ({value:txt(u.id),label:`${txt(u.code)} — ${txt(u.name)} (${txt(u.symbol)})`,code:txt(u.code),name:txt(u.name)}))} onChange={setPurchaseUnitId} placeholder="Select purchase unit"/></Field>
      <Field label="Base unit"><select value={baseUnitId} onChange={e => setBaseUnitId(e.target.value)} disabled>{units.map(u => <option key={txt(u.id)} value={txt(u.id)}>{txt(u.name)} ({txt(u.symbol)})</option>)}</select></Field>
      <Field label="Selling unit"><SearchableSelect value={sellingUnitId} options={units.map(u => ({value:txt(u.id),label:`${txt(u.code)} — ${txt(u.name)} (${txt(u.symbol)})`,code:txt(u.code),name:txt(u.name)}))} onChange={setSellingUnitId} placeholder="Select selling unit"/></Field>
      <Field label="Minimum stock"><input type="number" min="0" step="0.001" value={minimumStock} onChange={e => setMinimumStock(e.target.value)}/></Field>
      <Field label="Package"><input value={packageType} onChange={e => setPackageType(e.target.value)}/></Field>
      <Field label="Minimum sale size"><input value={packageSize} onChange={e => setPackageSize(e.target.value)}/></Field>
      <Field label="Notes"><input value={notes} onChange={e => setNotes(e.target.value)}/></Field>
    </div><div className="form-checks"><label><input type="checkbox" checked={canBeSold} onChange={e => setCanBeSold(e.target.checked)}/> Can be sold directly</label><label><input type="checkbox" checked={canBeUsed} onChange={e => setCanBeUsed(e.target.checked)}/> Can be used in production</label><label><input type="checkbox" checked={isIntermediate} onChange={e => setIsIntermediate(e.target.checked)}/> Intermediate / prepared material</label></div><div className="purchase-actions"><button className="secondary-button" type="button" onClick={closeEdit} disabled={busy}>Cancel</button><button className="primary-button" type="button" onClick={() => void save()} disabled={busy || !name.trim()}>{busy ? 'Saving…' : 'Save changes'}</button></div></div></div>}
  </div>
}
