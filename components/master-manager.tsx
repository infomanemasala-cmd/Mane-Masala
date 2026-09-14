'use client'

import { FormEvent, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Row = Record<string, unknown>
type MasterTable = 'items' | 'suppliers' | 'customers' | 'units' | 'categories' | 'sub_agents'

const itemTypes = [
  ['raw_material', 'Raw material'],
  ['intermediate', 'Intermediate'],
  ['finished_product', 'Finished product'],
  ['purchased_finished_product', 'Purchased finished product'],
]
const supplierTypes = [
  ['wholesaler', 'Wholesaler'],
  ['retailer', 'Retailer'],
  ['individual', 'Individual / Person'],
  ['farmer_producer', 'Farmer / Producer'],
  ['online_marketplace', 'Online marketplace'],
  ['manufacturer', 'Manufacturer'],
  ['other', 'Other'],
]
const customerTypes = [
  ['individual', 'Individual'],
  ['retail_shop', 'Retail shop'],
  ['restaurant', 'Restaurant'],
  ['caterer', 'Caterer'],
  ['online_customer', 'Online customer'],
  ['sub_agent', 'Sub-agent'],
]

function useRows(table: MasterTable) {
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState('')
  const load = async () => {
    const { data, error } = await createClient().from(table).select('*').order('created_at', { ascending: false }).limit(50)
    if (error) setError(error.message)
    else {
      setError('')
      setRows((data ?? []) as Row[])
    }
  }
  useEffect(() => { void load() }, [table])
  return { rows, error, reload: load }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="form-field"><span>{label}</span>{children}</label>
}

function SubmitButton({ busy, children }: { busy: boolean; children: React.ReactNode }) {
  return <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Saving…' : children}</button>
}

function MasterForm({ table, onSaved }: { table: MasterTable; onSaved: () => void }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [units, setUnits] = useState<Row[]>([])
  const [categories, setCategories] = useState<Row[]>([])
  const [customers, setCustomers] = useState<Row[]>([])

  useEffect(() => {
    const sb = createClient()
    if (table === 'items') {
      void sb.from('units').select('id,name,symbol').eq('is_active', true).order('name').then(({ data }) => setUnits((data ?? []) as Row[]))
      void sb.from('categories').select('id,name').eq('is_active', true).order('name').then(({ data }) => setCategories((data ?? []) as Row[]))
    }
    if (table === 'sub_agents') {
      void sb.from('customers').select('id,name,customer_type').eq('is_active', true).eq('customer_type', 'sub_agent').order('name').then(({ data }) => setCustomers((data ?? []) as Row[]))
    }
  }, [table])

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true); setMessage(''); setError('')
    const form = new FormData(event.currentTarget)
    const sb = createClient()
    let payload: Record<string, unknown>

    if (table === 'units') payload = { code: String(form.get('code') || '').trim() || null, name: String(form.get('name') || '').trim(), symbol: String(form.get('symbol') || '').trim() }
    else if (table === 'categories') payload = { code: String(form.get('code') || '').trim() || null, name: String(form.get('name') || '').trim() }
    else if (table === 'suppliers') payload = { business_code: String(form.get('business_code') || '').trim() || null, business_name: String(form.get('business_name') || '').trim(), supplier_type: String(form.get('supplier_type') || 'other'), phone: String(form.get('phone') || '').trim() || null, whatsapp: String(form.get('whatsapp') || '').trim() || null, upi_id: String(form.get('upi_id') || '').trim() || null, preferred_payment_method: String(form.get('preferred_payment_method') || '').trim() || null, notes: String(form.get('notes') || '').trim() || null }
    else if (table === 'customers') payload = { business_code: String(form.get('business_code') || '').trim() || null, name: String(form.get('name') || '').trim(), customer_type: String(form.get('customer_type') || 'individual'), phone: String(form.get('phone') || '').trim() || null, whatsapp: String(form.get('whatsapp') || '').trim() || null, notes: String(form.get('notes') || '').trim() || null }
    else if (table === 'sub_agents') payload = { business_code: String(form.get('business_code') || '').trim() || null, customer_id: String(form.get('customer_id') || '') || null, name: String(form.get('name') || '').trim(), phone: String(form.get('phone') || '').trim() || null, whatsapp: String(form.get('whatsapp') || '').trim() || null, notes: String(form.get('notes') || '').trim() || null }
    else {
      const baseUnit = String(form.get('base_unit_id') || '')
      payload = { business_code: String(form.get('business_code') || '').trim() || null, name: String(form.get('name') || '').trim(), item_type: String(form.get('item_type') || 'raw_material'), category_id: String(form.get('category_id') || '') || null, purchase_unit_id: baseUnit || null, base_unit_id: baseUnit, selling_unit_id: String(form.get('selling_unit_id') || '') || null, minimum_stock: Number(form.get('minimum_stock') || 0), is_perishable: form.get('is_perishable') === 'on', expiry_tracking_enabled: form.get('expiry_tracking_enabled') === 'on', notes: String(form.get('notes') || '').trim() || null }
    }

    const { error: insertError } = await sb.from(table).insert(payload)
    if (insertError) setError(insertError.message)
    else { setMessage('Saved successfully.'); event.currentTarget.reset(); onSaved() }
    setBusy(false)
  }

  return <form className="console-form" onSubmit={save}>
    {table === 'units' && <><Field label="Code"><input name="code" placeholder="KG" /></Field><Field label="Name"><input name="name" required placeholder="Kilogram" /></Field><Field label="Symbol"><input name="symbol" required placeholder="kg" /></Field></>}
    {table === 'categories' && <><Field label="Code"><input name="code" placeholder="SPICES" /></Field><Field label="Name"><input name="name" required placeholder="Spices" /></Field></>}
    {table === 'suppliers' && <><Field label="Business / Store name"><input name="business_name" required placeholder="Ganesh Stores" /></Field><Field label="Supplier type"><select name="supplier_type" defaultValue="wholesaler">{supplierTypes.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></Field><Field label="Phone"><input name="phone" /></Field><Field label="WhatsApp"><input name="whatsapp" /></Field><Field label="UPI ID"><input name="upi_id" /></Field><Field label="Preferred payment"><select name="preferred_payment_method" defaultValue=""><option value="">Not specified</option><option value="cash">Cash</option><option value="upi">UPI</option><option value="other">Other</option></select></Field><Field label="Notes"><input name="notes" /></Field></>}
    {table === 'customers' && <><Field label="Customer name"><input name="name" required placeholder="Customer name" /></Field><Field label="Customer type"><select name="customer_type" defaultValue="individual">{customerTypes.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></Field><Field label="Phone"><input name="phone" /></Field><Field label="WhatsApp"><input name="whatsapp" /></Field><Field label="Notes"><input name="notes" /></Field></>}
    {table === 'sub_agents' && <><Field label="Existing sub-agent customer"><select name="customer_id" required><option value="">Select customer</option>{customers.map(c => <option key={String(c.id)} value={String(c.id)}>{String(c.name)}</option>)}</select></Field><Field label="Sub-agent name"><input name="name" required /></Field><Field label="Phone"><input name="phone" /></Field><Field label="WhatsApp"><input name="whatsapp" /></Field><Field label="Notes"><input name="notes" /></Field></>}
    {table === 'items' && <><Field label="Item name"><input name="name" required placeholder="Chilli Powder" /></Field><Field label="Item type"><select name="item_type" defaultValue="raw_material">{itemTypes.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></Field><Field label="Category"><select name="category_id" defaultValue=""><option value="">No category</option>{categories.map(c => <option key={String(c.id)} value={String(c.id)}>{String(c.name)}</option>)}</select></Field><Field label="Base / purchase unit"><select name="base_unit_id" required defaultValue=""><option value="">Select unit</option>{units.map(u => <option key={String(u.id)} value={String(u.id)}>{String(u.name)} ({String(u.symbol)})</option>)}</select></Field><Field label="Selling unit"><select name="selling_unit_id" defaultValue=""><option value="">Same as base / not applicable</option>{units.map(u => <option key={String(u.id)} value={String(u.id)}>{String(u.name)} ({String(u.symbol)})</option>)}</select></Field><Field label="Minimum stock"><input name="minimum_stock" type="number" min="0" step="0.001" defaultValue="0" /></Field><Field label="Perishable"><input name="is_perishable" type="checkbox" /></Field><Field label="Track expiry"><input name="expiry_tracking_enabled" type="checkbox" /></Field><Field label="Notes"><input name="notes" /></Field></>}
    <SubmitButton busy={busy}>Save</SubmitButton>
    {message && <p className="form-status form-status-success">{message}</p>}
    {error && <p className="form-status form-status-error">{error}</p>}
  </form>
}

export default function MasterManager({ table }: { table: MasterTable }) {
  const { rows, error, reload } = useRows(table)
  return <div className="master-manager">
    <div className="master-create"><h3>Add {table.replaceAll('_', ' ')}</h3><MasterForm table={table} onSaved={reload} /></div>
    <div className="master-list">{error ? <p className="form-status form-status-error">{error}</p> : !rows.length ? <p className="empty-state">No records yet.</p> : <div className="table-wrap"><table><thead><tr>{Object.keys(rows[0]).filter(k => !['id','created_at','updated_at'].includes(k)).slice(0,8).map(k => <th key={k}>{k.replaceAll('_',' ')}</th>)}</tr></thead><tbody>{rows.map((r,i) => <tr key={String(r.id ?? i)}>{Object.keys(rows[0]).filter(k => !['id','created_at','updated_at'].includes(k)).slice(0,8).map(k => <td key={k}>{String(r[k] ?? '')}</td>)}</tr>)}</tbody></table></div>}</div>
  </div>
}
