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
const db = () => createClient()
const txt = (v: any) => String(v ?? '')

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

function MasterForm({ table, editing = null, onSaved, onCancel }: { table: Exclude<MasterTable,'items'>; editing?: Row | null; onSaved: () => void; onCancel?: () => void }) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('')
  const [units, setUnits] = useState<Row[]>([]), [categories, setCategories] = useState<Row[]>([]), [customers, setCustomers] = useState<Row[]>([]), [itemTypes, setItemTypes] = useState<Row[]>([])
  const [trackExpiry, setTrackExpiry] = useState(false)

  const loadLists = async () => {
    const sb = createClient()
    if (table === 'categories') void sb.from('categories').select('id,name,code').eq('is_active', true).order('name').then(({ data }) => setCategories((data ?? []) as Row[]))
    if (table === 'sub_agents') void sb.from('customers').select('id,name,customer_type,business_code').eq('is_active', true).eq('customer_type', 'sub_agent').order('name').then(({ data }) => setCustomers((data ?? []) as Row[]))
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
    const form = new FormData(event.currentTarget), sb = createClient(); let payload: Record<string, unknown> = {}
    if (table === 'units') payload = { name: String(form.get('name') || '').trim(), symbol: String(form.get('symbol') || '').trim() }
    else if (table === 'categories') payload = { name: String(form.get('name') || '').trim(), parent_category_id: String(form.get('parent_category_id') || '') || null }
    else if (table === 'suppliers') payload = { business_name: String(form.get('business_name') || '').trim(), contact_person: String(form.get('contact_person') || '').trim() || null, supplier_type: String(form.get('supplier_type') || 'other'), phone: String(form.get('phone') || '').trim() || null, whatsapp: String(form.get('whatsapp') || '').trim() || null, order_call_number: String(form.get('order_call_number') || '').trim() || null, upi_id: String(form.get('upi_id') || '').trim() || null, gpay_phonepe: String(form.get('gpay_phonepe') || '').trim() || null, address: String(form.get('address') || '').trim() || null, gst_number: String(form.get('gst_number') || '').trim() || null, email: String(form.get('email') || '').trim() || null, preferred_payment_method: String(form.get('preferred_payment_method') || '').trim() || null, notes: String(form.get('notes') || '').trim() || null }
    else if (table === 'customers') payload = { name: String(form.get('name') || '').trim(), customer_type: String(form.get('customer_type') || 'individual'), phone: String(form.get('phone') || '').trim() || null, whatsapp: String(form.get('whatsapp') || '').trim() || null, email: String(form.get('email') || '').trim() || null, address: String(form.get('address') || '').trim() || null, gst_number: String(form.get('gst_number') || '').trim() || null, notes: String(form.get('notes') || '').trim() || null }
    else if (table === 'sub_agents') payload = { customer_id: String(form.get('customer_id') || '') || null, name: String(form.get('name') || '').trim(), phone: String(form.get('phone') || '').trim() || null, whatsapp: String(form.get('whatsapp') || '').trim() || null, address: String(form.get('address') || '').trim() || null, notes: String(form.get('notes') || '').trim() || null }
    const result = editing ? await sb.from(table).update(payload).eq('id', editing.id).select('*').single() : await sb.from(table).insert(payload).select('*').single()
    if (result.error) setError(result.error.message)
    else { const generated = String((result.data as Row)?.business_code ?? (result.data as Row)?.code ?? txt(editing?.business_code ?? editing?.code)); setMessage(generated ? `Saved successfully. Code: ${generated}` : 'Saved successfully.'); event.currentTarget.reset(); setTrackExpiry(false); onSaved() }
    setBusy(false)
  }

  return <form className="console-form" onSubmit={save}>
    {table === 'units' && <><Field label="Name" required><input name="name" required placeholder="Kilogram" defaultValue={txt(editing?.name)} /></Field><Field label="Symbol" required><input name="symbol" required placeholder="kg" defaultValue={txt(editing?.symbol)} /></Field></>}
    {table === 'categories' && <><Field label="Category / Subcategory name" required><input name="name" required placeholder="Spices" defaultValue={txt(editing?.name)} /></Field><Field label="Parent category"><select name="parent_category_id" defaultValue={txt(editing?.parent_category_id)}><option value="">Top-level Category</option>{categories.map((category) => <option key={String(category.id)} value={String(category.id)}>{String(category.code)} — {String(category.name)}</option>)}</select></Field><p className="muted">Blank parent = Category. A selected parent = Subcategory.</p></>}
    {table === 'suppliers' && <><Field label="Business / Store name" required><input name="business_name" required placeholder="Ganesh Stores" defaultValue={txt(editing?.business_name)} /></Field><Field label="Contact person"><input name="contact_person" defaultValue={txt(editing?.contact_person)} /></Field><Field label="Supplier type" required><select name="supplier_type" defaultValue={txt(editing?.supplier_type || "wholesaler")}>{supplierTypes.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></Field><Field label="Phone"><input name="phone" defaultValue={txt(editing?.phone)} /></Field><Field label="WhatsApp"><input name="whatsapp" defaultValue={txt(editing?.whatsapp)} /></Field><Field label="Order / Call number"><input name="order_call_number" defaultValue={txt(editing?.order_call_number)} /></Field><Field label="UPI ID"><input name="upi_id" defaultValue={txt(editing?.upi_id)} /></Field><Field label="GPay / PhonePe"><input name="gpay_phonepe" defaultValue={txt(editing?.gpay_phonepe)} /></Field><Field label="Address"><input name="address" defaultValue={txt(editing?.address)} /></Field><Field label="GST number"><input name="gst_number" defaultValue={txt(editing?.gst_number)} /></Field><Field label="Email"><input name="email" type="email" defaultValue={txt(editing?.email)} /></Field><Field label="Preferred payment"><select name="preferred_payment_method" defaultValue={txt(editing?.preferred_payment_method)}><option value="">Not specified</option><option value="cash">Cash</option><option value="upi">UPI</option><option value="other">Other</option></select></Field><Field label="Notes"><input name="notes" defaultValue={txt(editing?.notes)} /></Field></>}
    {table === 'customers' && <><Field label="Customer name" required><input name="name" required placeholder="Customer name" defaultValue={txt(editing?.name)} /></Field><Field label="Customer type" required><select name="customer_type" defaultValue={txt(editing?.customer_type || "individual")}>{customerTypes.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></Field><Field label="Phone"><input name="phone" /></Field><Field label="WhatsApp"><input name="whatsapp" /></Field><Field label="Email"><input name="email" type="email" /></Field><Field label="Address"><input name="address" /></Field><Field label="GST number"><input name="gst_number" /></Field><Field label="Notes"><input name="notes" /></Field></>}
    {table === 'sub_agents' && <><Field label="Existing sub-agent customer" required><select name="customer_id" required defaultValue={txt(editing?.customer_id)}><option value="">Select customer</option>{customers.map((customer) => <option key={String(customer.id)} value={String(customer.id)}>{String(customer.name)}</option>)}</select></Field><Field label="Sub-agent name" required><input name="name" required defaultValue={txt(editing?.name)} /></Field><Field label="Phone"><input name="phone" /></Field><Field label="WhatsApp"><input name="whatsapp" /></Field><Field label="Address"><input name="address" /></Field><Field label="Notes"><input name="notes" /></Field></>}
   <SubmitButton busy={busy}>{editing ? `Save ${titles[table]}` : `Create ${titles[table]}`}</SubmitButton>{message && <p className="form-status form-status-success">{message}</p>}{error && <p className="form-status form-status-error">{error}</p>}
  </form>
}

function MasterList({ table, refreshToken, onEdit }: { table: Exclude<MasterTable,'items'>; refreshToken: number; onEdit: (row: Row) => void }) {
  const [rows,setRows]=useState<Row[]>([]),[view,setView]=useState<'active'|'inactive'|'archived'>('active'),[search,setSearch]=useState(''),[selected,setSelected]=useState<string[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('')
  const load=async()=>{const {data,error:e}=await db().from(table).select('*').order(table==='suppliers'?'business_name':table==='customers'||table==='sub_agents'?'name':table==='categories'||table==='units'?'name':'name');if(e)setError(e.message);else setRows(data??[])}
  useEffect(()=>{void load()},[table,refreshToken])
  const status=(r:Row)=>r.archived_at?'archived':r.is_active?'active':'inactive'
  const fields=table==='suppliers'?['business_code','business_name','supplier_type','phone']:table==='customers'?['business_code','name','customer_type','phone']:table==='sub_agents'?['business_code','name','phone']:table==='categories'?['code','name']:['code','name','symbol']
  const filtered=rows.filter(r=>status(r)===view&&(!search.trim()||fields.some(k=>txt(r[k]).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))))
  const setActive=async(id:string,active:boolean)=>{setBusy(true);setError('');const {error:e}=await db().from(table).update({is_active:active}).eq('id',id);setBusy(false);if(e)setError(e.message);else{setMessage(active?'Set Active.':'Set Inactive.');await load()}}
  const archive=async()=>{setBusy(true);setError('');for(const id of selected){const {error:e}=await db().rpc('archive_master_record',{p_table:table,p_id:id,p_reason:'Archived from Master Data'});if(e){setError(e.message);setBusy(false);return}}setSelected([]);setBusy(false);setMessage('Archived successfully.');await load()}
  const restore=async(id:string)=>{if(!window.confirm('Restore this record to Active?'))return;setBusy(true);const {error:e}=await db().rpc('restore_master_record',{p_table:table,p_id:id});setBusy(false);if(e)setError(e.message);else{setMessage('Restored successfully.');await load()}}
  return <div className="data-table"><div className="table-toolbar"><input className="table-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search code or name…" aria-label={`Search ${titles[table]}`}/><div className="table-toolbar-right"><button className={view==='active'?'secondary-button tab-active':'secondary-button'} onClick={()=>{setView('active');setSelected([])}}>Active</button><button className={view==='inactive'?'secondary-button tab-active':'secondary-button'} onClick={()=>{setView('inactive');setSelected([])}}>Inactive</button><button className={view==='archived'?'secondary-button tab-active':'secondary-button'} onClick={()=>{setView('archived');setSelected([])}}>Archived</button></div></div><div className="table-wrap"><table><thead><tr>{view!=='archived'&&<th><input type="checkbox" checked={filtered.length>0&&filtered.every(r=>selected.includes(txt(r.id)))} onChange={e=>setSelected(e.target.checked?filtered.map(r=>txt(r.id)):[])}/></th>}{fields.map(f=><th key={f}>{f.replaceAll('_',' ').replace(/\\b\\w/g,l=>l.toUpperCase())}</th>)}<th>Action</th></tr></thead><tbody>{filtered.map(r=><tr key={txt(r.id)}>{view!=='archived'&&<td><input type="checkbox" checked={selected.includes(txt(r.id))} onChange={e=>setSelected(v=>e.target.checked?[...new Set([...v,txt(r.id)])]:v.filter(x=>x!==txt(r.id)))}/></td>}{fields.map(f=><td key={f}>{txt(r[f])}</td>)}<td>{view==='archived'?<button className="secondary-button" onClick={()=>void restore(txt(r.id))} disabled={busy}>Restore</button>:<><button className="secondary-button" onClick={()=>onEdit(r)} disabled={busy}>Edit</button><button className="secondary-button" onClick={()=>void setActive(txt(r.id),view!=='active')} disabled={busy}>{view==='active'?'Set Inactive':'Set Active'}</button></>}</td></tr>)}{!filtered.length&&<tr><td colSpan={fields.length+2} className="table-message">No records found.</td></tr>}</tbody></table></div>{message&&<p className="form-status form-status-success">{message}</p>}{error&&<p className="form-status form-status-error">{error}</p>}{view!=='archived'&&<div className="purchase-actions"><button className="secondary-button" disabled={!selected.length||busy} onClick={()=>void archive()}>Archive{selected.length?` (${selected.length})`:''}</button></div>}</div>
}

export default function MasterManager({ table }: { table: MasterTable }) {
  const [refreshToken,setRefreshToken]=useState(0),[open,setOpen]=useState(false),[editing,setEditing]=useState<Row|null>(null)
  if(table==='items') return <MasterItemManager/>
  return <div className="master-manager"><div className="master-header"><div><h2>{titles[table]} Master</h2><p>Create, edit, activate, inactivate, archive and restore retained master records. Permanent codes are generated by the live database.</p></div><button className="primary-button" onClick={()=>{setEditing(null);setOpen(true)}}>+ Create {titles[table]}</button></div><MasterList table={table} refreshToken={refreshToken} onEdit={row=>{setEditing(row);setOpen(true)}}/>{open&&<div className="modal-backdrop"><div className="modal-card purchase-modal"><div className="modal-header"><h3>{editing?'Edit':'Create'} {titles[table]}</h3></div><MasterForm table={table} editing={editing} onCancel={()=>{setOpen(false);setEditing(null)}} onSaved={()=>{setOpen(false);setEditing(null);setRefreshToken(v=>v+1)}}/></div></div>}</div>
}
