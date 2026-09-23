'use client'

import { FormEvent, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import DataTable from '@/components/data-table'
import MasterItemManager from '@/components/master-item-manager'

type Row = Record<string, unknown>
type MasterTable = 'items' | 'suppliers' | 'customers' | 'units' | 'categories' | 'sub_agents'
type SelectOption = { value: string; label: string }
const supplierTypes = [['wholesaler', 'Wholesaler'], ['retailer', 'Retailer'], ['individual', 'Individual / Person'], ['farmer_producer', 'Farmer / Producer'], ['online_marketplace', 'Online marketplace'], ['manufacturer', 'Manufacturer'], ['other', 'Other']]
const customerTypes = [['individual', 'Individual'], ['retail_shop', 'Retail shop'], ['restaurant', 'Restaurant'], ['caterer', 'Caterer'], ['online_customer', 'Online customer'], ['sub_agent', 'Sub-agent']]
const titles: Record<MasterTable, string> = { items: 'Item', suppliers: 'Supplier', customers: 'Customer', units: 'Unit', categories: 'Category', sub_agents: 'Sub-agent' }

function Field({ label, children, required = false }: { label: string; children: React.ReactNode; required?: boolean }) { return <label className="form-field"><span>{label}{required ? ' *' : ''}</span>{children}</label> }
function SubmitButton({ busy, children }: { busy: boolean; children: React.ReactNode }) { return <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Saving…' : children}</button> }
function slugify(value: string) { return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') }

function CreateableSelect({ name, initialValue = '', options, placeholder, createLabel, onCreate }: { name: string; initialValue?: string; options: SelectOption[]; placeholder: string; createLabel: string; onCreate: (name: string) => Promise<SelectOption | null> }) {
  const [open, setOpen] = useState(false), [dialogOpen, setDialogOpen] = useState(false), [draft, setDraft] = useState(''), [selected, setSelected] = useState(initialValue), [creating, setCreating] = useState(false)
  const selectedOption = options.find((option) => option.value === selected)

  const create = async () => {
    const nameValue = draft.trim(); if (!nameValue) return
    setCreating(true)
    const option = await onCreate(nameValue)
    if (option) { setSelected(option.value); setDraft(''); setDialogOpen(false); setOpen(false) }
    setCreating(false)
  }

  return <div className="createable-select">
    <input type="hidden" name={name} value={selected} />
    <button className="select-trigger" type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((value) => !value)}>{selectedOption?.label ?? placeholder}<span aria-hidden="true">▾</span></button>
    {open && <div className="select-menu" role="listbox">
      {options.map((option) => <button className={`select-option${selected === option.value ? ' select-option-selected' : ''}`} key={option.value} type="button" role="option" aria-selected={selected === option.value} onClick={() => { setSelected(option.value); setOpen(false) }}>{option.label}</button>)}
      <div className="select-menu-divider" />
      <button className="select-create-action" type="button" onClick={() => { setDialogOpen(true); setDraft('') }}>{createLabel}</button>
    </div>}
    {dialogOpen && <div className="nested-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !creating) setDialogOpen(false) }}><div className="nested-modal-card" role="dialog" aria-modal="true" aria-label={createLabel.replace('+ Create new ', 'Create ')}><div className="modal-header"><h4>{createLabel.replace('+ Create new ', 'Create ')}</h4><button className="secondary-button" type="button" onClick={() => setDialogOpen(false)} disabled={creating}>Close</button></div><Field label="Name" required><input autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void create() } }} placeholder="Enter name" /></Field><div className="nested-modal-actions"><button className="secondary-button" type="button" onClick={() => setDialogOpen(false)} disabled={creating}>Cancel</button><button className="primary-button" type="button" onClick={() => void create()} disabled={creating || !draft.trim()}>{creating ? 'Creating…' : 'Create'}</button></div></div></div>}
  </div>
}

function MasterForm({ table, onSaved }: { table: MasterTable; onSaved: () => void }) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('')
  const [units, setUnits] = useState<Row[]>([]), [categories, setCategories] = useState<Row[]>([]), [customers, setCustomers] = useState<Row[]>([]), [itemTypes, setItemTypes] = useState<Row[]>([])
  const [trackExpiry, setTrackExpiry] = useState(false)

  const loadLists = async () => {
    const sb = createClient()
    if (table === 'items') {
      const [u, c, t] = await Promise.all([
        sb.from('units').select('id,name,symbol').eq('is_active', true).order('name'),
        sb.from('categories').select('id,name,code').eq('is_active', true).order('name'),
        sb.from('item_types').select('id,code,name').eq('is_active', true).order('name'),
      ])
      setUnits((u.data ?? []) as Row[]); setCategories((c.data ?? []) as Row[]); setItemTypes((t.data ?? []) as Row[])
    }
    if (table === 'sub_agents') void sb.from('customers').select('id,name,customer_type').eq('is_active', true).eq('customer_type', 'sub_agent').order('name').then(({ data }) => setCustomers((data ?? []) as Row[]))
  }
  useEffect(() => { void loadLists() }, [table])

  const createCategory = async (name: string): Promise<SelectOption | null> => {
    setError(''); const sb = createClient(); const { data, error: insertError } = await sb.from('categories').insert({ name }).select('id,name,code').single()
    if (insertError) { setError(insertError.message); return null }
    setCategories((rows) => [...rows, data as Row].sort((a, b) => String(a.name).localeCompare(String(b.name))))
    setMessage(`New category created: ${String((data as Row).code)}`)
    return { value: String((data as Row).id), label: `${String((data as Row).code)} — ${String((data as Row).name)}` }
  }

  const createItemType = async (name: string): Promise<SelectOption | null> => {
    setError(''); const base = slugify(name); const sb = createClient(); let code = base || 'custom_type'; let suffix = 1
    while (true) {
      const { data: existing } = await sb.from('item_types').select('id').eq('code', code).maybeSingle()
      if (!existing) break
      suffix += 1; code = `${base}_${suffix}`
    }
    const { data, error: insertError } = await sb.from('item_types').insert({ name, code }).select('id,name,code').single()
    if (insertError) { setError(insertError.message); return null }
    setItemTypes((rows) => [...rows, data as Row].sort((a, b) => String(a.name).localeCompare(String(b.name))))
    setMessage(`New item type created: ${String((data as Row).code)}`)
    return { value: String((data as Row).code), label: String((data as Row).name) }
  }

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setMessage(''); setError('')
    const form = new FormData(event.currentTarget), sb = createClient(); let payload: Record<string, unknown>
    if (table === 'units') payload = { name: String(form.get('name') || '').trim(), symbol: String(form.get('symbol') || '').trim() }
    else if (table === 'categories') payload = { name: String(form.get('name') || '').trim() }
    else if (table === 'suppliers') payload = { business_name: String(form.get('business_name') || '').trim(), contact_person: String(form.get('contact_person') || '').trim() || null, supplier_type: String(form.get('supplier_type') || 'other'), phone: String(form.get('phone') || '').trim() || null, whatsapp: String(form.get('whatsapp') || '').trim() || null, order_call_number: String(form.get('order_call_number') || '').trim() || null, upi_id: String(form.get('upi_id') || '').trim() || null, gpay_phonepe: String(form.get('gpay_phonepe') || '').trim() || null, address: String(form.get('address') || '').trim() || null, gst_number: String(form.get('gst_number') || '').trim() || null, email: String(form.get('email') || '').trim() || null, preferred_payment_method: String(form.get('preferred_payment_method') || '').trim() || null, notes: String(form.get('notes') || '').trim() || null }
    else if (table === 'customers') payload = { name: String(form.get('name') || '').trim(), customer_type: String(form.get('customer_type') || 'individual'), phone: String(form.get('phone') || '').trim() || null, whatsapp: String(form.get('whatsapp') || '').trim() || null, email: String(form.get('email') || '').trim() || null, address: String(form.get('address') || '').trim() || null, gst_number: String(form.get('gst_number') || '').trim() || null, notes: String(form.get('notes') || '').trim() || null }
    else if (table === 'sub_agents') payload = { customer_id: String(form.get('customer_id') || '') || null, name: String(form.get('name') || '').trim(), phone: String(form.get('phone') || '').trim() || null, whatsapp: String(form.get('whatsapp') || '').trim() || null, address: String(form.get('address') || '').trim() || null, notes: String(form.get('notes') || '').trim() || null }
    else {
      const baseUnit = String(form.get('base_unit_id') || ''), durationValue = trackExpiry ? Number(form.get('expiry_duration_value') || 0) : null, durationUnit = trackExpiry ? String(form.get('expiry_duration_unit') || '') : null
      if (trackExpiry && (!durationValue || !durationUnit)) { setError('Please enter the expiry duration and choose days, months or years.'); setBusy(false); return }
      payload = { name: String(form.get('name') || '').trim(), item_type: String(form.get('item_type') || ''), category_id: String(form.get('category_id') || '') || null, purchase_unit_id: baseUnit || null, base_unit_id: baseUnit, selling_unit_id: String(form.get('selling_unit_id') || '') || null, minimum_stock: Number(form.get('minimum_stock') || 0), can_be_sold: form.get('can_be_sold') === 'on', can_be_used_in_production: form.get('can_be_used_in_production') === 'on', is_intermediate: form.get('is_intermediate') === 'on', is_perishable: form.get('is_perishable') === 'on', expiry_tracking_enabled: trackExpiry, expiry_duration_value: durationValue, expiry_duration_unit: durationUnit, notes: String(form.get('notes') || '').trim() || null }
    }
    const { data, error: insertError } = await sb.from(table).insert(payload).select('business_code,code').single()
    if (insertError) setError(insertError.message)
    else { const generated = String((data as Row)?.business_code ?? (data as Row)?.code ?? ''); setMessage(generated ? `Saved successfully. Code: ${generated}` : 'Saved successfully.'); event.currentTarget.reset(); setTrackExpiry(false); onSaved() }
    setBusy(false)
  }

  return <form className="console-form" onSubmit={save}>
    {table === 'units' && <><Field label="Name" required><input name="name" required placeholder="Kilogram" /></Field><Field label="Symbol" required><input name="symbol" required placeholder="kg" /></Field></>}
    {table === 'categories' && <Field label="Category name" required><input name="name" required placeholder="Spices" /></Field>}
    {table === 'suppliers' && <><Field label="Business / Store name" required><input name="business_name" required placeholder="Ganesh Stores" /></Field><Field label="Contact person"><input name="contact_person" /></Field><Field label="Supplier type" required><select name="supplier_type" defaultValue="wholesaler">{supplierTypes.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></Field><Field label="Phone"><input name="phone" /></Field><Field label="WhatsApp"><input name="whatsapp" /></Field><Field label="Order / Call number"><input name="order_call_number" /></Field><Field label="UPI ID"><input name="upi_id" /></Field><Field label="GPay / PhonePe"><input name="gpay_phonepe" /></Field><Field label="Address"><input name="address" /></Field><Field label="GST number"><input name="gst_number" /></Field><Field label="Email"><input name="email" type="email" /></Field><Field label="Preferred payment"><select name="preferred_payment_method" defaultValue=""><option value="">Not specified</option><option value="cash">Cash</option><option value="upi">UPI</option><option value="other">Other</option></select></Field><Field label="Notes"><input name="notes" /></Field></>}
    {table === 'customers' && <><Field label="Customer name" required><input name="name" required placeholder="Customer name" /></Field><Field label="Customer type" required><select name="customer_type" defaultValue="individual">{customerTypes.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></Field><Field label="Phone"><input name="phone" /></Field><Field label="WhatsApp"><input name="whatsapp" /></Field><Field label="Email"><input name="email" type="email" /></Field><Field label="Address"><input name="address" /></Field><Field label="GST number"><input name="gst_number" /></Field><Field label="Notes"><input name="notes" /></Field></>}
    {table === 'sub_agents' && <><Field label="Existing sub-agent customer" required><select name="customer_id" required><option value="">Select customer</option>{customers.map((customer) => <option key={String(customer.id)} value={String(customer.id)}>{String(customer.name)}</option>)}</select></Field><Field label="Sub-agent name" required><input name="name" required /></Field><Field label="Phone"><input name="phone" /></Field><Field label="WhatsApp"><input name="whatsapp" /></Field><Field label="Address"><input name="address" /></Field><Field label="Notes"><input name="notes" /></Field></>}
    {table === 'items' && <>
      <Field label="Item name" required><input name="name" required placeholder="Peanut Butter" /></Field>
      <Field label="Item type" required><CreateableSelect name="item_type" initialValue="finished_product" options={itemTypes.map((type) => ({ value: String(type.code), label: String(type.name) }))} placeholder="Select item type" createLabel="+ Create new item type" onCreate={createItemType} /></Field>
      <Field label="Category"><CreateableSelect name="category_id" options={categories.map((category) => ({ value: String(category.id), label: `${String(category.code)} — ${String(category.name)}` }))} placeholder="No category" createLabel="+ Create new category" onCreate={createCategory} /></Field>
      <Field label="Base / purchase unit" required><select name="base_unit_id" required defaultValue=""><option value="">Select unit</option>{units.map((unit) => <option key={String(unit.id)} value={String(unit.id)}>{String(unit.name)} ({String(unit.symbol)})</option>)}</select></Field>
      <Field label="Selling unit"><select name="selling_unit_id" defaultValue=""><option value="">Same as base / not applicable</option>{units.map((unit) => <option key={String(unit.id)} value={String(unit.id)}>{String(unit.name)} ({String(unit.symbol)})</option>)}</select></Field>
      <Field label="Minimum stock"><input name="minimum_stock" type="number" min="0" step="0.001" defaultValue="0" /></Field>
      <div className="form-checks"><label><input name="can_be_sold" type="checkbox" defaultChecked /> Can be sold directly</label><label><input name="can_be_used_in_production" type="checkbox" /> Can be used in production</label><label><input name="is_intermediate" type="checkbox" /> Can be held as intermediate / prepared material</label><label><input name="is_perishable" type="checkbox" /> Perishable</label><label><input name="expiry_tracking_enabled" type="checkbox" checked={trackExpiry} onChange={(e) => setTrackExpiry(e.target.checked)} /> Track expiry</label></div>
      {trackExpiry && <div className="expiry-duration"><Field label="Expiry duration" required><input name="expiry_duration_value" type="number" min="0.01" step="0.01" required placeholder="6" /></Field><Field label="Duration unit" required><select name="expiry_duration_unit" required defaultValue="months"><option value="days">Days</option><option value="months">Months</option><option value="years">Years</option></select></Field><p className="muted">The system will use this duration when tracking expiry for stock batches.</p></div>}
      <Field label="Notes"><input name="notes" /></Field>
    </>}
    <SubmitButton busy={busy}>Create {titles[table]}</SubmitButton>{message && <p className="form-status form-status-success">{message}</p>}{error && <p className="form-status form-status-error">{error}</p>}
  </form>
}

export default function MasterManager({ table }: { table: MasterTable }) {
  if (table === 'items') return <MasterItemManager />
  const [refreshToken, setRefreshToken] = useState(0), [open, setOpen] = useState(false)
  return <div className="master-manager"><div className="master-header"><div><h2>{titles[table]} Master</h2><p>Create records here. The system generates the permanent business code automatically.</p></div><button className="primary-button" onClick={() => setOpen(true)}>+ Create {titles[table]}</button></div>{open && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false) }}><div className="modal-card" role="dialog" aria-modal="true" aria-label={`Create ${titles[table]}`}><div className="modal-header"><h3>Create {titles[table]}</h3><button className="secondary-button" type="button" onClick={() => setOpen(false)}>Close</button></div><p className="muted">Business code is generated automatically after you save.</p><MasterForm table={table} onSaved={() => { setRefreshToken((value) => value + 1); setOpen(false) }} /></div></div>}<div className="master-list"><DataTable table={table} refreshToken={refreshToken} /></div></div>
}
