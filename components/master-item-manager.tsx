'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import SearchableSelect from '@/components/searchable-select'

type Row = Record<string, any>
const db = () => createClient()
const txt = (v: any) => String(v ?? '')
const statusOf = (row: Row) => row.archived_at ? 'ARCHIVED' : row.is_active ? 'ACTIVE' : 'INACTIVE'

function Field({ label, children, required = false }: { label: string; children: React.ReactNode; required?: boolean }) { return <label className="form-field"><span>{label}{required ? ' *' : ''}</span>{children}</label> }

function packageFields(notes: string) {
  const packageMatch = notes.match(/Package:\s*([^|\n]+)/i)
  const sizeMatch = notes.match(/Minimum package\/sale size:\s*([^|\n]+)/i)
  return { packageType: packageMatch?.[1]?.trim() ?? '', packageSize: sizeMatch?.[1]?.trim() ?? '' }
}

export default function MasterItemManager({ requestedCreateType, onCreateRequestConsumed }: { requestedCreateType?: string | null; onCreateRequestConsumed?: () => void }) {
  const [rows, setRows] = useState<Row[]>([]), [search, setSearch] = useState(''), [sort, setSort] = useState('item_code'), [ascending, setAscending] = useState(true)
  const [selected, setSelected] = useState<string[]>([]), [editing, setEditing] = useState<Row | null>(null), [creating, setCreating] = useState(false), [view, setView] = useState<'active' | 'inactive' | 'archived'>('active'), [pendingArchive, setPendingArchive] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [units, setUnits] = useState<Row[]>([]), [categories, setCategories] = useState<Row[]>([]), [types, setTypes] = useState<Row[]>([])
  const [name, setName] = useState(''), [itemType, setItemType] = useState(''), [categoryId, setCategoryId] = useState(''), [subcategory, setSubcategory] = useState(''), [productFamily, setProductFamily] = useState(''), [purchaseUnitId, setPurchaseUnitId] = useState(''), [baseUnitId, setBaseUnitId] = useState(''), [sellingUnitId, setSellingUnitId] = useState(''), [minimumStock, setMinimumStock] = useState('0'), [canBeSold, setCanBeSold] = useState(false), [canBeUsed, setCanBeUsed] = useState(false), [isIntermediate, setIsIntermediate] = useState(false), [isPerishable, setIsPerishable] = useState(false), [expiryTracking, setExpiryTracking] = useState(false), [expiryValue, setExpiryValue] = useState(''), [expiryUnit, setExpiryUnit] = useState('months'), [notes, setNotes] = useState(''), [packageType, setPackageType] = useState(''), [packageSize, setPackageSize] = useState('')

  const load = async () => {
    const [itemsRes, unitsRes, catsRes, typesRes] = await Promise.all([
      db().from('items').select('*').order('name'),
      db().from('units').select('id,code,name').eq('is_active', true).order('name'),
      db().from('categories').select('id,name').eq('is_active', true).order('name'),
      db().from('item_types').select('code,name').eq('is_active', true).order('name'),
    ])
    setRows(itemsRes.data ?? []); setUnits(unitsRes.data ?? []); setCategories(catsRes.data ?? []); setTypes(typesRes.data ?? [])
  }
  useEffect(() => { void load() }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = rows.filter(r => {
      const active = Boolean(r.is_active); const archived = Boolean(r.archived_at)
      if (view === 'active') return active && !archived
      if (view === 'inactive') return !active && !archived
      return archived
    })
    if (q) list = list.filter(r => [r.item_code, r.business_code, r.name, r.item_type].some(v => txt(v).toLowerCase().includes(q)))
    list = [...list].sort((a, b) => {
      const av = txt(a[sort]).toLowerCase(), bv = txt(b[sort]).toLowerCase()
      if (av < bv) return ascending ? -1 : 1
      if (av > bv) return ascending ? 1 : -1
      return 0
    })
    return list
  }, [rows, search, sort, ascending, view])

  const unitLabel = (id: string) => { const u = units.find(x => txt(x.id) === id); return u ? `${txt(u.code)}` : id }
  const chooseSort = (col: string) => { if (sort === col) setAscending(v => !v); else { setSort(col); setAscending(true) } }

  const openCreate = (preset = '') => {
    const type = preset || txt(types[0]?.code) || 'raw_material'
    setEditing(null); setCreating(true); setName(''); setItemType(type); setCategoryId(''); setSubcategory(''); setProductFamily(''); setPurchaseUnitId(''); setBaseUnitId(''); setSellingUnitId(''); setMinimumStock('0')
    setCanBeSold(type === 'finished_product' || type === 'purchased_finished_product')
    setCanBeUsed(type === 'raw_material' || type === 'intermediate')
    setIsIntermediate(type === 'intermediate')
    setIsPerishable(false); setExpiryTracking(false); setExpiryValue(''); setExpiryUnit('months'); setNotes(''); setPackageType(''); setPackageSize(''); setMessage(''); setError('')
  }
  useEffect(() => { if (requestedCreateType) { openCreate(requestedCreateType); onCreateRequestConsumed?.() } }, [requestedCreateType])

  const openEdit = (row: Row) => {
    const p = packageFields(txt(row.notes))
    const packType = txt(row.selling_pack_type) || p.packageType
    const packSize = row.selling_pack_size_kg != null && row.selling_pack_size_kg !== '' ? txt(row.selling_pack_size_kg) : p.packageSize
    setCreating(false); setEditing(row); setName(txt(row.name)); setItemType(txt(row.item_type)); setCategoryId(txt(row.category_id)); setSubcategory(txt(row.subcategory)); setProductFamily(txt(row.product_family)); setPurchaseUnitId(txt(row.purchase_unit_id)); setBaseUnitId(txt(row.base_unit_id)); setSellingUnitId(txt(row.selling_unit_id)); setMinimumStock(txt(row.minimum_stock)); setCanBeSold(Boolean(row.can_be_sold)); setCanBeUsed(Boolean(row.can_be_used_in_production)); setIsIntermediate(Boolean(row.is_intermediate)); setIsPerishable(Boolean(row.is_perishable)); setExpiryTracking(Boolean(row.expiry_tracking_enabled)); setExpiryValue(txt(row.expiry_duration_value)); setExpiryUnit(txt(row.expiry_duration_unit || 'months')); setNotes(txt(row.notes)); setPackageType(packType); setPackageSize(packSize); setMessage(''); setError('')
  }
  const closeEdit = () => { setEditing(null); setCreating(false) }

  const save = async () => {
    setBusy(true); setMessage(''); setError('')
    const payload = { p_name: name.trim(), p_item_type: itemType, p_category_id: categoryId || null, p_subcategory: subcategory.trim() || null, p_product_family: productFamily.trim() || null, p_purchase_unit_id: purchaseUnitId || null, p_base_unit_id: baseUnitId, p_selling_unit_id: sellingUnitId || null, p_minimum_stock: Number(minimumStock || 0), p_can_be_sold: canBeSold, p_can_be_used_in_production: canBeUsed, p_is_intermediate: isIntermediate, p_is_perishable: isPerishable, p_expiry_tracking_enabled: expiryTracking, p_expiry_duration_value: expiryTracking ? Number(expiryValue) : null, p_expiry_duration_unit: expiryTracking ? expiryUnit : null, p_notes: notes.trim() || null }
    if (expiryTracking && (!expiryValue || Number(expiryValue) <= 0)) { setError('Expiry tracking requires a positive duration.'); setBusy(false); return }
    if (!name.trim() || !itemType || !baseUnitId) { setError('Name, item type and base unit are required.'); setBusy(false); return }
    if (canBeSold && !(packageSize.trim() && Number(packageSize) > 0)) { setError('Sellable items require pack size (kg).'); setBusy(false); return }
    if (editing) {
      const packSizeKg = packageSize.trim() ? Number(packageSize) : null
      const packLabel = packageType && packSizeKg ? `${packageType} ${packSizeKg} kg` : (packageType || null)
      const { error: e } = await db().rpc('update_master_item', { p_item_id: editing.id, p_name: name.trim(), p_item_type: itemType, p_category_id: categoryId || null, p_subcategory: subcategory.trim() || null, p_product_family: productFamily.trim() || null, p_purchase_unit_id: purchaseUnitId || null, p_base_unit_id: baseUnitId, p_selling_unit_id: sellingUnitId || null, p_minimum_stock: Number(minimumStock || 0), p_can_be_sold: canBeSold, p_can_be_used_in_production: canBeUsed, p_is_intermediate: isIntermediate, p_is_perishable: isPerishable, p_expiry_tracking_enabled: expiryTracking, p_expiry_duration_value: expiryTracking ? Number(expiryValue) : null, p_expiry_duration_unit: expiryTracking ? expiryUnit : null, p_notes: payload.p_notes, p_selling_pack_type: packageType.trim() || null, p_selling_pack_size_kg: packSizeKg && packSizeKg > 0 ? packSizeKg : null, p_selling_pack_label: packLabel })
      setBusy(false); if (e) { setError(e.message); return } setMessage('Saved. Permanent code was not changed.'); setEditing(null); await load(); return
    }
    const { data, error: createError } = await db().from('items').insert({ name: payload.p_name, item_type: payload.p_item_type, category_id: payload.p_category_id, subcategory: payload.p_subcategory, product_family: payload.p_product_family, purchase_unit_id: payload.p_purchase_unit_id, base_unit_id: payload.p_base_unit_id, selling_unit_id: payload.p_selling_unit_id, minimum_stock: payload.p_minimum_stock, can_be_sold: payload.p_can_be_sold, can_be_used_in_production: payload.p_can_be_used_in_production, is_intermediate: payload.p_is_intermediate, is_perishable: payload.p_is_perishable, expiry_tracking_enabled: payload.p_expiry_tracking_enabled, expiry_duration_value: payload.p_expiry_duration_value, expiry_duration_unit: payload.p_expiry_duration_unit, notes: payload.p_notes, selling_pack_type: packageType.trim() || null, selling_pack_size_kg: packageSize.trim() && Number(packageSize) > 0 ? Number(packageSize) : null, selling_pack_label: packageType.trim() && packageSize.trim() ? `${packageType.trim()} ${Number(packageSize)} kg` : (packageType.trim() || null) }).select('item_code,business_code').single()
    setBusy(false); if (createError) { setError(createError.message); return }
    setMessage(`Created ${txt(data?.item_code || data?.business_code)}.`); setCreating(false); await load()
  }

  const setItemStatus = async (id: string, active: boolean) => {
    setBusy(true); setMessage(''); setError('')
    const { error: e } = await db().from('items').update({ is_active: active }).eq('id', id)
    setBusy(false); if (e) { setError(e.message); return } setMessage(active ? 'Set active.' : 'Set inactive.'); await load()
  }
  const restore = async (id: string) => {
    if (!window.confirm('Restore this record to the active list?')) return
    setBusy(true); setMessage(''); setError('')
    const { error: e } = await db().rpc('restore_master_record', { p_table: 'items', p_id: id })
    setBusy(false); if (e) { setError(e.message); return } setMessage('Restored successfully.'); await load()
  }

  const unitOptions = units.map(u => ({
    value: txt(u.id),
    label: `${txt(u.code)}${u.name ? ` — ${txt(u.name)}` : ''}`,
    code: txt(u.code),
    name: txt(u.name),
  }))

  return (
    <div className="master-manager">
      <div className="panel-heading"><div><h2>Items</h2><span>Master catalogue. Sellable items need pack type + size (kg).</span></div>
        <div className="purchase-actions"><button className="primary-button" type="button" onClick={() => openCreate()} disabled={busy}>Create Item</button></div>
      </div>
      {message && <p className={`form-status${error ? ' form-status-error' : ''}`} role="alert">{error || message}</p>}
      <div className="toolbar-row"><input className="search-input" placeholder="Search code or name" value={search} onChange={e => setSearch(e.target.value)} />
        <div className="segmented">{(['active','inactive','archived'] as const).map(v => <button key={v} className={view === v ? 'secondary-button tab-active' : 'secondary-button'} type="button" onClick={() => { setView(v); setSelected([]) }}>{v}</button>)}</div>
      </div>
      <div className="table-wrap"><table><thead><tr>
        <th><button className="table-sort" type="button" onClick={() => chooseSort('item_code')}>Code</button></th>
        <th><button className="table-sort" type="button" onClick={() => chooseSort('name')}>Name</button></th>
        <th>Type</th><th>Unit</th><th>Pack</th><th>Status</th><th>Action</th>
      </tr></thead><tbody>
        {filtered.map(row => (
          <tr key={txt(row.id)}>
            <td>{txt(row.item_code || row.business_code)}</td>
            <td>{txt(row.name)}</td>
            <td>{txt(row.item_type)}</td>
            <td>{unitLabel(txt(row.base_unit_id))}</td>
            <td>{txt(row.selling_pack_label) || (row.selling_pack_size_kg ? `${row.selling_pack_size_kg} kg` : '—')}</td>
            <td>{statusOf(row)}</td>
            <td>{view === 'archived' ? <button className="secondary-button" type="button" onClick={() => void restore(txt(row.id))} disabled={busy}>Restore</button> : <><button className="secondary-button" type="button" onClick={() => openEdit(row)} disabled={busy}>Edit</button><button className="secondary-button" type="button" onClick={() => void setItemStatus(txt(row.id), view === 'active' ? false : true)} disabled={busy}>{view === 'active' ? 'Set Inactive' : 'Set Active'}</button></>}</td>
          </tr>
        ))}
        {!filtered.length && <tr><td colSpan={7} className="table-message">No records found.</td></tr>}
      </tbody></table></div>

      {(editing || creating) && <div className="modal-backdrop"><div className="modal-card purchase-modal">
        <div className="modal-header"><div><h3>{creating ? 'Create Item' : `Edit ${txt(editing?.item_code || editing?.business_code)} — ${txt(editing?.name)}`}</h3><p className="muted">Permanent business code cannot be changed.</p></div><button className="secondary-button" type="button" onClick={closeEdit} disabled={busy}>Close</button></div>
        <div className="form-grid">
          <Field label="Name" required><input value={name} onChange={e => setName(e.target.value)} required /></Field>
          <Field label="Item type" required><select value={itemType} onChange={e => setItemType(e.target.value)}>{types.map(t => <option key={txt(t.code)} value={txt(t.code)}>{txt(t.name || t.code)}</option>)}</select></Field>
          <Field label="Category"><select value={categoryId} onChange={e => setCategoryId(e.target.value)}><option value="">—</option>{categories.map(c => <option key={txt(c.id)} value={txt(c.id)}>{txt(c.name)}</option>)}</select></Field>
          <Field label="Subcategory"><input value={subcategory} onChange={e => setSubcategory(e.target.value)} /></Field>
          <Field label="Product family"><input value={productFamily} onChange={e => setProductFamily(e.target.value)} /></Field>
          <Field label="Base unit" required><SearchableSelect value={baseUnitId} options={unitOptions} onChange={setBaseUnitId} placeholder="Select base unit" /></Field>
          <Field label="Purchase unit"><SearchableSelect value={purchaseUnitId} options={unitOptions} onChange={setPurchaseUnitId} placeholder="Select purchase unit" /></Field>
          <Field label="Selling unit"><SearchableSelect value={sellingUnitId} options={unitOptions} onChange={setSellingUnitId} placeholder="Select selling unit" /></Field>
          <Field label="Minimum stock"><input type="number" min="0" step="0.001" value={minimumStock} onChange={e => setMinimumStock(e.target.value)} /></Field>
          <Field label="Selling pack type"><input value={packageType} onChange={e => setPackageType(e.target.value)} placeholder="e.g. pouch, jar, box" /></Field>
          <Field label="Pack size (kg)"><input type="number" min="0.001" step="0.001" value={packageSize} onChange={e => setPackageSize(e.target.value)} placeholder="e.g. 0.25" /></Field>
          <Field label="Notes"><input value={notes} onChange={e => setNotes(e.target.value)} /></Field>
        </div>
        <div className="form-checks">
          <label><input type="checkbox" checked={canBeSold} onChange={e => setCanBeSold(e.target.checked)} /> Can be sold directly</label>
          <label><input type="checkbox" checked={canBeUsed} onChange={e => setCanBeUsed(e.target.checked)} /> Can be used in production</label>
          <label><input type="checkbox" checked={isIntermediate} onChange={e => setIsIntermediate(e.target.checked)} /> Intermediate / prepared material</label>
          <label><input type="checkbox" checked={isPerishable} onChange={e => setIsPerishable(e.target.checked)} /> Perishable</label>
          <label><input type="checkbox" checked={expiryTracking} onChange={e => setExpiryTracking(e.target.checked)} /> Track expiry</label>
        </div>
        {expiryTracking && <div className="expiry-duration">
          <Field label="Expiry duration" required><input type="number" min="0.01" step="0.01" value={expiryValue} onChange={e => setExpiryValue(e.target.value)} required /></Field>
          <Field label="Duration unit" required><select value={expiryUnit} onChange={e => setExpiryUnit(e.target.value)}><option value="days">Days</option><option value="months">Months</option><option value="years">Years</option></select></Field>
        </div>}
        <div className="purchase-actions">
          <button className="secondary-button" type="button" onClick={closeEdit} disabled={busy}>Cancel</button>
          <button className="primary-button" type="button" onClick={() => void save()} disabled={busy || !name.trim() || !itemType || !baseUnitId}>{busy ? 'Saving…' : creating ? 'Create Item' : 'Save changes'}</button>
        </div>
      </div></div>}
    </div>
  )
}
