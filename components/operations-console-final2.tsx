'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import DataTable from '@/components/data-table'

type Row = Record<string, any>
type Module = 'inventory' | 'production' | 'orders' | 'sales' | 'payments'
const supabase = () => createClient()
const today = () => new Date().toISOString().slice(0, 10)
const text = (v: any) => String(v ?? '')

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>
}
function Select({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: ReactNode }) {
  return <select value={value} onChange={e => onChange(e.target.value)}>{children}</select>
}
function Status({ message, error = false }: { message: string; error?: boolean }) {
  return message ? <p className={`form-status${error ? ' form-status-error' : ''}`} role="alert">{message}</p> : null
}
function Modal({ title, close, children, wide = false }: { title: string; close: () => void; children: ReactNode; wide?: boolean }) {
  return <div className="modal-backdrop"><div className={`modal-card${wide ? ' purchase-modal' : ''}`}>
    <div className="modal-header"><h3>{title}</h3><button className="secondary-button" onClick={close}>Close</button></div>
    {children}
  </div></div>
}
function useRows(table: string) {
  const [rows, setRows] = useState<Row[]>([])
  const load = async () => { const { data } = await supabase().from(table).select('*').limit(500); setRows(data ?? []) }
  useEffect(() => { void load() }, [table])
  return [rows, load] as const
}
function Page({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <section className="page-panel"><div className="section-label">Mane Masala</div>
    <div className="master-header"><div><h1>{title}</h1><p className="page-intro">{description}</p></div>{children}</div>
  </section>
}

function Orders() {
  const [customers] = useRows('customers')
  const [agents] = useRows('sub_agents')
  const [items] = useRows('items')
  const [orders, loadOrders] = useRows('v_orders_list')
  const [open, setOpen] = useState(false)
  const [drafts, setDrafts] = useState<any[]>([blankOrder()])
  const [selected, setSelected] = useState<Row | null>(null)
  const [planLines, setPlanLines] = useState<any[]>([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  const [saving, setSaving] = useState(false)

  const saveOrders = async () => {
    for (let i = 0; i < drafts.length; i++) {
      const d = drafts[i]
      const billing = d.party === 'direct' ? d.customerId : agents.find(a => text(a.id) === d.subAgentId)?.customer_id
      if (!billing) return fail(`Order ${i + 1}: select the billing party.`)
      if (d.party === 'sub_agent' && d.endMode === 'existing' && !d.endCustomerId) return fail(`Order ${i + 1}: select the end customer.`)
      if (d.party === 'sub_agent' && d.endMode === 'named' && !d.endName.trim()) return fail(`Order ${i + 1}: enter the end customer name.`)
      if (!d.lines.some((l: any) => l.itemId && Number(l.quantity) > 0)) return fail(`Order ${i + 1}: add at least one item.`)
    }
    const payload = drafts.map(d => {
      const billing = d.party === 'direct' ? d.customerId : agents.find(a => text(a.id) === d.subAgentId)?.customer_id
      return {
        customer_id: billing,
        order_party_type: d.party,
        sub_agent_id: d.party === 'sub_agent' ? d.subAgentId : null,
        end_customer_customer_id: d.party === 'sub_agent' && d.endMode === 'existing' ? d.endCustomerId : null,
        end_customer_name: d.party === 'sub_agent' && d.endMode === 'named' ? d.endName.trim() : null,
        end_customer_phone: d.party === 'sub_agent' ? d.endPhone.trim() || null : null,
        end_customer_is_anonymous: d.party === 'sub_agent' && d.endMode === 'anonymous',
        order_date: d.date,
        estimated_dispatch_date: d.dispatchDate || null,
        source: d.source,
        advance_amount: Number(d.advance || 0),
        requests: d.requests.trim() || null,
        notes: d.notes.trim() || null,
        lines: d.lines.filter((l: any) => l.itemId && Number(l.quantity) > 0).map((l: any) => ({ item_id: l.itemId, ordered_quantity: Number(l.quantity), selling_rate: Number(l.rate || 0) }))
      }
    })
    setSaving(true)
    const { error: e } = await supabase().rpc('create_order_entry_session', { p_orders: payload })
    setSaving(false)
    if (e) return fail(e.message)
    setOpen(false); setDrafts([blankOrder()]); await loadOrders(); setMessage(`${drafts.length} order${drafts.length === 1 ? '' : 's'} received. Prepare, reserve, then confirm.`)
  }
  const fail = (m: string) => { setError(true); setMessage(m) }

  const openPlan = async (order: Row) => {
    setSelected(order); setMessage(''); setError(false)
    const [{ data: ols }, { data: inv }, { data: rvs }] = await Promise.all([
      supabase().from('order_lines').select('id,item_id,ordered_quantity,unit_id,selling_rate,reserved_quantity,produced_quantity,dispatched_quantity').eq('order_id', order.id),
      supabase().from('v_inventory_current').select('*'),
      supabase().from('recipe_versions').select('id,recipe_id,version_number,expected_output_quantity,output_unit_id,status,recipes!inner(output_item_id,name,status)').eq('status', 'active')
    ])
    const invMap = new Map((inv ?? []).map(x => [text(x.item_id), x]))
    const activeRecipes = (rvs ?? []).filter((r: any) => r.recipes?.status === 'active')
    setPlanLines((ols ?? []).map((l: any) => {
      const stock = invMap.get(text(l.item_id))
      const available = Math.max(0, Number(stock?.available_stock ?? 0))
      const shortfall = Math.max(0, Number(l.ordered_quantity) - Math.min(Number(l.ordered_quantity), available))
      const options = activeRecipes.filter((r: any) => text(r.recipes?.output_item_id) === text(l.item_id))
      const item = items.find(i => text(i.id) === text(l.item_id))
      return { ...l, itemCode: item?.item_code, itemName: item?.name, available, shortfall, recipeVersionId: options.length === 1 ? text(options[0].id) : '', recipeOptions: options }
    }))
  }
  const prepare = async () => {
    if (!selected) return
    const selections = planLines.filter(l => Number(l.shortfall) > 0).map(l => ({ order_line_id: l.id, recipe_version_id: l.recipeVersionId }))
    if (planLines.some(l => Number(l.shortfall) > 0 && !l.recipeVersionId)) return fail('Select a recipe version for every item that needs production.')
    const { error: e } = await supabase().rpc('prepare_order_plan', { p_order_id: selected.id, p_recipe_selections: selections })
    if (e) return fail(e.message)
    setError(false); setMessage('Production plan prepared and inventory reserved. Now confirm the order.')
    setSelected({ ...selected, status: 'production_planned' }); await loadOrders()
  }
  const confirm = async () => {
    if (!selected) return
    const { error: e } = await supabase().rpc('confirm_order', { p_order_id: selected.id })
    if (e) return fail(e.message)
    setError(false); setMessage('Order confirmed. Production work is now visible in Production.')
    setSelected({ ...selected, status: 'confirmed' }); await loadOrders()
  }

  return <Page title="Orders" description="Customer call → order details → production plan and recipe version when needed → reserve inventory → confirm → production → dispatch + Sale + Invoice.">
    <button className="primary-button" onClick={() => setOpen(true)}>+ Create Order</button>
    {open && <CreateOrdersModal drafts={drafts} setDrafts={setDrafts} customers={customers} agents={agents} items={items} save={saveOrders} saving={saving} close={() => setOpen(false)} message={message} error={error} />}
    <div className="console-panel" style={{ marginTop: 18 }}><div className="panel-heading"><h2>Order workflow queue</h2></div>
      {orders.filter(o => ['received', 'production_planned'].includes(text(o.status))).map(o => <div className="workflow-row" key={text(o.id)}><div><strong>{text(o.business_code)}</strong><span>{text(o.billing_customer_name)} · {text(o.status)} · {text(o.ordered_quantity)} ordered</span></div><button className="secondary-button" onClick={() => openPlan(o)}>{o.status === 'received' ? 'Prepare plan & reserve' : 'Confirm order'}</button></div>)}
      {!orders.some(o => ['received', 'production_planned'].includes(text(o.status))) && <p className="table-message">No orders awaiting planning or confirmation.</p>}
    </div>
    {selected && <Modal title={`Order ${text(selected.business_code)} — Plan & Reserve`} close={() => setSelected(null)} wide>
      <p className="page-intro">Available finished stock is reserved first. A shortfall requires an active recipe version; the system scales the recipe and reserves its required ingredients.</p>
      {planLines.map((l: any) => <div className="purchase-line" key={text(l.id)}><div className="field"><span>Item</span><div><strong>{text(l.itemCode)}</strong> — {text(l.itemName)}</div></div><Field label="Ordered"><input value={text(l.ordered_quantity)} readOnly /></Field><Field label="Available"><input value={String(l.available)} readOnly /></Field><Field label="Production needed"><input value={String(l.shortfall)} readOnly /></Field>{Number(l.shortfall) > 0 && <Field label="Recipe version"><Select value={l.recipeVersionId} onChange={v => setPlanLines(x => x.map(z => z.id === l.id ? { ...z, recipeVersionId: v } : z))}><option value="">Select recipe version</option>{l.recipeOptions.map((r: any) => <option key={text(r.id)} value={text(r.id)}>v{text(r.version_number)} — {text(r.recipes?.name)}</option>)}</Select></Field>}</div>)}
      <Status message={message} error={error} />
      {selected.status === 'received' && <button className="primary-button" onClick={prepare}>Prepare plan & reserve inventory</button>}
      {selected.status === 'production_planned' && <button className="primary-button" onClick={confirm}>Confirm order</button>}
    </Modal>}
    <div className="console-panel" style={{ marginTop: 18 }}><div className="panel-heading"><h2>All orders</h2></div><DataTable table="v_orders_list" /></div>
  </Page>
}
function blankOrder() { return { party: 'direct', customerId: '', subAgentId: '', endMode: 'existing', endCustomerId: '', endName: '', endPhone: '', source: 'whatsapp', date: today(), dispatchDate: '', advance: '', requests: '', notes: '', lines: [{ itemId: '', quantity: '', rate: '' }] } }
function CreateOrdersModal({ drafts, setDrafts, customers, agents, items, save, saving, close, message, error }: any) {
  const patch = (i: number, k: string, v: any) => setDrafts((x: any[]) => x.map((d, n) => n === i ? { ...d, [k]: v } : d))
  const line = (oi: number, li: number, k: string, v: any) => setDrafts((x: any[]) => x.map((d, n) => n === oi ? { ...d, lines: d.lines.map((l: any, j: number) => j === li ? { ...l, [k]: v } : l) } : d))
  return <Modal title="Create customer orders" close={close} wide>{drafts.map((d: any, oi: number) => <div className="console-panel" key={oi} style={{ marginBottom: 16 }}><div className="panel-heading"><h2>Order {oi + 1}</h2><button className="secondary-button" disabled={drafts.length === 1} onClick={() => setDrafts((x: any[]) => x.filter((_, n) => n !== oi))}>Remove</button></div>
    <div className="form-grid"><Field label="Order type"><Select value={d.party} onChange={v => patch(oi, 'party', v)}><option value="direct">Direct customer</option><option value="sub_agent">Through Sub-Agent</option></Select></Field>{d.party === 'direct' ? <Field label="Bill To — Customer"><Select value={d.customerId} onChange={v => patch(oi, 'customerId', v)}><option value="">Select customer</option>{customers.map((c: any) => <option key={text(c.id)} value={text(c.id)}>{text(c.name)} — {text(c.business_code)}</option>)}</Select></Field> : <Field label="Bill To — Sub-Agent"><Select value={d.subAgentId} onChange={v => patch(oi, 'subAgentId', v)}><option value="">Select Sub-Agent</option>{agents.map((a: any) => <option key={text(a.id)} value={text(a.id)}>{text(a.name)} — {text(a.business_code)}</option>)}</Select></Field>}<Field label="Order date"><input type="date" value={d.date} onChange={e => patch(oi, 'date', e.target.value)} /></Field><Field label="Estimated dispatch"><input type="date" value={d.dispatchDate} onChange={e => patch(oi, 'dispatchDate', e.target.value)} /></Field></div>
    {d.party === 'sub_agent' && <div className="form-grid"><Field label="End customer"><Select value={d.endMode} onChange={v => patch(oi, 'endMode', v)}><option value="existing">Existing customer</option><option value="named">Named but not registered</option><option value="anonymous">Anonymous</option></Select></Field>{d.endMode === 'existing' && <Field label="End customer record"><Select value={d.endCustomerId} onChange={v => patch(oi, 'endCustomerId', v)}><option value="">Select end customer</option>{customers.map((c: any) => <option key={text(c.id)} value={text(c.id)}>{text(c.name)}</option>)}</Select></Field>}{d.endMode === 'named' && <Field label="End customer name"><input value={d.endName} onChange={e => patch(oi, 'endName', e.target.value)} /></Field>}<Field label="End customer phone"><input value={d.endPhone} onChange={e => patch(oi, 'endPhone', e.target.value)} /></Field></div>}
    <div className="form-grid"><Field label="Order source"><Select value={d.source} onChange={v => patch(oi, 'source', v)}><option value="whatsapp">WhatsApp</option><option value="sms">SMS</option><option value="phone">Phone</option><option value="social_media">Social Media</option><option value="walk_in">Walk-in</option><option value="online_marketplace">Online Marketplace</option></Select></Field><Field label="Advance received / noted"><input type="number" min="0" step="0.01" value={d.advance} onChange={e => patch(oi, 'advance', e.target.value)} /></Field></div>
    <h3>Items on this order</h3>{d.lines.map((l: any, li: number) => <div className="purchase-line" key={li}><Field label="Item"><Select value={l.itemId} onChange={v => line(oi, li, 'itemId', v)}><option value="">Select item</option>{items.filter((i: any) => i.is_active !== false && i.can_be_sold !== false).map((i: any) => <option key={text(i.id)} value={text(i.id)}>{text(i.item_code)} — {text(i.name)}</option>)}</Select></Field><Field label="Quantity"><input type="number" min="0" step="0.001" value={l.quantity} onChange={e => line(oi, li, 'quantity', e.target.value)} /></Field><Field label="Selling rate"><input type="number" min="0" step="0.01" value={l.rate} onChange={e => line(oi, li, 'rate', e.target.value)} /></Field></div>)}
    <button className="add-row-button" onClick={() => patch(oi, 'lines', [...d.lines, { itemId: '', quantity: '', rate: '' }])}>＋ Add item row</button><div className="form-grid"><Field label="Requests"><textarea value={d.requests} onChange={e => patch(oi, 'requests', e.target.value)} /></Field><Field label="Notes"><textarea value={d.notes} onChange={e => patch(oi, 'notes', e.target.value)} /></Field></div>
  </div>)}<button className="add-row-button" onClick={() => setDrafts((x: any[]) => [...x, blankOrder()])}>＋ Add another customer order</button><Status message={message} error={error} /><button className="primary-button" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save received orders'}</button></Modal>
}

function Inventory() {
  const [items] = useRows('items'); const [units] = useRows('units'); const [open, setOpen] = useState(false); const [kind, setKind] = useState<'out'|'adjust'>('out'); const [iid, setIid] = useState(''); const [uid, setUid] = useState(''); const [qty, setQty] = useState(''); const [reason, setReason] = useState('damage'); const [notes, setNotes] = useState(''); const [message, setMessage] = useState(''); const [error, setError] = useState(false)
  const submit = async () => { const n = Number(qty); if (!iid || !uid || !n) { setError(true); setMessage('Item, unit and a non-zero quantity are required.'); return } const rpc = kind === 'out' ? 'record_stock_out' : 'record_stock_adjustment'; const args = kind === 'out' ? { p_item_id: iid, p_quantity: n, p_unit_id: uid, p_stock_out_date: today(), p_reason: reason, p_notes: notes || null } : { p_item_id: iid, p_quantity_delta: n, p_unit_id: uid, p_adjustment_date: today(), p_reason: reason, p_notes: notes || null }; const { error: e } = await supabase().rpc(rpc, args); if (e) { setError(true); setMessage(e.message); return } setError(false); setMessage(kind === 'out' ? 'Stock Out recorded using FIFO.' : 'Stock Adjustment recorded.'); setQty(''); setNotes(''); setOpen(false) }
  return <Page title="Inventory" description="Current stock comes from transactions. Reservations are commitments, not stock reductions."><button className="primary-button" onClick={() => setOpen(true)}>+ Stock Action</button>{open && <Modal title="Stock Action" close={() => setOpen(false)}><div className="master-tabs"><button className={kind === 'out' ? 'tab-active' : ''} onClick={() => setKind('out')}>Stock Out</button><button className={kind === 'adjust' ? 'tab-active' : ''} onClick={() => setKind('adjust')}>Stock Adjustment</button></div><div className="form-grid"><Field label="Item"><Select value={iid} onChange={setIid}><option value="">Select item</option>{items.map(i => <option key={text(i.id)} value={text(i.id)}>{text(i.item_code)} — {text(i.name)}</option>)}</Select></Field><Field label="Unit"><Select value={uid} onChange={setUid}><option value="">Select unit</option>{units.map(u => <option key={text(u.id)} value={text(u.id)}>{text(u.name)} ({text(u.symbol)})</option>)}</Select></Field><Field label={kind === 'out' ? 'Quantity' : 'Adjustment (+ adds / − removes)'}><input type="number" step="0.001" value={qty} onChange={e => setQty(e.target.value)} /></Field><Field label="Reason"><Select value={reason} onChange={setReason}><option value="damage">Damage</option><option value="expiry">Expiry</option><option value="sample">Sample</option><option value="wastage">Wastage</option><option value="personal_use">Personal use</option><option value="production">Production</option><option value="correction">Correction</option><option value="other">Other</option></Select></Field></div><Field label="Notes"><textarea value={notes} onChange={e => setNotes(e.target.value)} /></Field><Status message={message} error={error} /><button className="primary-button" onClick={submit}>Record</button></Modal>}<div className="console-panel" style={{ marginTop: 18 }}><div className="panel-heading"><h2>Current stock</h2></div><DataTable table="v_inventory_current" /></div><div className="console-panel" style={{ marginTop: 18 }}><div className="panel-heading"><h2>Inventory movements</h2></div><DataTable table="inventory_transactions" /></div></Page>
}

function Production() {
  const [batches, load] = useRows('v_production_batches_list'); const [items] = useRows('items'); const [open, setOpen] = useState(false); const [bid, setBid] = useState(''); const [selected, setSelected] = useState<Row|null>(null); const [cons, setCons] = useState<any[]>([]); const [out, setOut] = useState(''); const [message, setMessage] = useState(''); const [error, setError] = useState(false)
  const choose = async (id: string) => { setBid(id); const b = batches.find(x => text(x.id) === id); setSelected(b ?? null); setOut(text(b?.planned_output_quantity)); if (!id) { setCons([]); return } const { data } = await supabase().from('production_batch_plan_lines').select('id,ingredient_item_id,planned_quantity,unit_id').eq('production_batch_id', id).order('id'); setCons((data ?? []).map(x => ({ id: x.id, itemId: text(x.ingredient_item_id), unitId: text(x.unit_id), planned: text(x.planned_quantity), actual: text(x.planned_quantity) }))) }
  const approve = async () => { if (!bid) return; const { data: u } = await supabase().auth.getUser(); const { error: e } = await supabase().from('production_batches').update({ wife_approval_status: 'approved', approved_by: u.user?.id ?? null, approved_at: new Date().toISOString() }).eq('id', bid); if (e) { setError(true); setMessage(e.message); return } setError(false); setMessage('Production batch approved.'); setSelected(s => s ? { ...s, wife_approval_status: 'approved' } : s); await load() }
  const start = async () => { const { error: e } = await supabase().rpc('start_production_batch', { p_production_batch_id: bid }); if (e) { setError(true); setMessage(e.message); return } setError(false); setMessage('Production started.'); setSelected(s => s ? { ...s, status: 'in_progress' } : s); await load() }
  const complete = async () => { if (!selected) return; const c = cons.filter(x => Number(x.actual) > 0).map(x => ({ ingredient_item_id: x.itemId, actual_quantity: Number(x.actual), unit_id: x.unitId })); if (!c.length || Number(out) <= 0) { setError(true); setMessage('Enter actual consumption and output.'); return } const { error: e } = await supabase().rpc('complete_production', { p_production_batch_id: bid, p_consumptions: c, p_outputs: [{ output_item_id: selected.output_item_id, quantity: Number(out), unit_id: selected.output_unit_id }] }); if (e) { setError(true); setMessage(e.message); return } setError(false); setMessage('Production completed. Ingredient stock consumed and finished stock created.'); setOpen(false); await load() }
  return <Page title="Production" description="Order-driven production shows the batch, selected recipe version, planned ingredients, approval, start, actual consumption and output."><button className="primary-button" onClick={() => setOpen(true)}>+ Review Production</button>{open && <Modal title="Production batch" close={() => setOpen(false)} wide><Field label="Production batch"><Select value={bid} onChange={choose}><option value="">Select planned batch</option>{batches.filter(b => text(b.status) !== 'completed').map(b => <option key={text(b.id)} value={text(b.id)}>{text(b.business_code)} — {text(b.order_code) || 'Unlinked'} — {text(b.output_item_name)} — {text(b.status)}</option>)}</Select></Field>{selected && <div className="console-panel"><div className="panel-heading"><h2>{text(selected.output_item_code)} — {text(selected.output_item_name)}</h2></div><p className="page-intro">Order: {text(selected.order_code) || 'Not order-driven'} · Recipe version: {text(selected.recipe_version) || '—'}</p><div className="form-grid"><Field label="Planned output"><input value={text(selected.planned_output_quantity)} readOnly /></Field><Field label="Actual output"><input type="number" min="0" step="0.001" value={out} onChange={e => setOut(e.target.value)} /></Field></div><h3>Planned ingredients</h3>{cons.map((x, i) => <div className="purchase-line" key={x.id}><div className="field"><span>Ingredient</span><div>{text(items.find(it => text(it.id) === x.itemId)?.item_code)} — {text(items.find(it => text(it.id) === x.itemId)?.name)}</div></div><Field label="Planned"><input value={x.planned} readOnly /></Field><Field label="Actual"><input type="number" min="0" step="0.001" value={x.actual} onChange={e => setCons(v => v.map((z, n) => n === i ? { ...z, actual: e.target.value } : z))} /></Field></div>)}<Status message={message} error={error} /><div className="purchase-actions"><button className="secondary-button" onClick={approve} disabled={selected.wife_approval_status === 'approved'}>{selected.wife_approval_status === 'approved' ? 'Approved' : 'Approve production'}</button><button className="secondary-button" onClick={start} disabled={selected.status !== 'planned' || selected.wife_approval_status !== 'approved'}>Start production</button><button className="primary-button" onClick={complete} disabled={!['planned','in_progress'].includes(text(selected.status)) || selected.wife_approval_status !== 'approved'}>Complete production</button></div></div>}</Modal>}<div className="console-panel"><div className="panel-heading"><h2>Production batches</h2></div><DataTable table="v_production_batches_list" /></div></Page>
}

function Sales() {
  const [orders] = useRows('orders'); const [items] = useRows('items'); const [open, setOpen] = useState(false); const [oid, setOid] = useState(''); const [method, setMethod] = useState('own_delivery'); const [lines, setLines] = useState<any[]>([]); const [message, setMessage] = useState(''); const [error, setError] = useState(false)
  const loadLines = async (id: string) => { setOid(id); const { data } = await supabase().from('order_lines').select('id,item_id,ordered_quantity,dispatched_quantity,unit_id,selling_rate').eq('order_id', id); setLines((data ?? []).map(x => ({ ...x, dispatchQty: String(Math.max(0, Number(x.ordered_quantity) - Number(x.dispatched_quantity || 0))) }))) }
  const dispatchInvoice = async () => { const selected = lines.filter(x => Number(x.dispatchQty) > 0); if (!oid || !selected.length) { setError(true); setMessage('Select an order and at least one quantity.'); return } const { error: e } = await supabase().rpc('dispatch_and_invoice_order', { p_order_id: oid, p_dispatch_date: today(), p_method: method, p_lines: selected.map(x => ({ order_line_id: x.id, quantity: Number(x.dispatchQty) })) }); if (e) { setError(true); setMessage(e.message); return } setError(false); setMessage('Dispatch completed. Sale and Invoice were raised from that exact dispatch.'); setLines([]); setOid('') }
  return <Page title="Sales & Invoices" description="Dispatch is the physical handover. The same approved dispatch creates the Sale and Invoice; there is no second stock deduction."><button className="primary-button" onClick={() => setOpen(true)}>+ Dispatch + Sale + Invoice</button>{open && <Modal title="Dispatch → Sale → Invoice" close={() => setOpen(false)} wide><div className="form-grid"><Field label="Order"><Select value={oid} onChange={loadLines}><option value="">Select confirmed order</option>{orders.filter(o => ['confirmed','in_production','ready','partially_dispatched'].includes(text(o.status))).map(o => <option key={text(o.id)} value={text(o.id)}>{text(o.business_code)} — {text(o.status)}</option>)}</Select></Field><Field label="Dispatch method"><Select value={method} onChange={setMethod}><option value="customer_pickup">Customer pickup</option><option value="own_delivery">Own delivery</option><option value="courier">Courier</option><option value="transport">Transport</option><option value="other">Other</option></Select></Field></div>{lines.map((x, i) => <div className="purchase-line" key={text(x.id)}><div className="field"><span>Item</span><div>{text(items.find(it => text(it.id) === text(x.item_id))?.item_code)} — {text(items.find(it => text(it.id) === text(x.item_id))?.name)}</div></div><Field label="Remaining"><input value={String(Math.max(0, Number(x.ordered_quantity) - Number(x.dispatched_quantity || 0)))} readOnly /></Field><Field label="Dispatch quantity"><input type="number" min="0" step="0.001" value={x.dispatchQty} onChange={e => setLines(v => v.map((z, n) => n === i ? { ...z, dispatchQty: e.target.value } : z))} /></Field></div>)}<Status message={message} error={error} /><button className="primary-button" onClick={dispatchInvoice}>Dispatch + Sale + Invoice</button></Modal>}<div className="console-grid"><div className="console-panel"><div className="panel-heading"><h2>Dispatches</h2></div><DataTable table="dispatches" /></div><div className="console-panel"><div className="panel-heading"><h2>Sales</h2></div><DataTable table="sales" /></div><div className="console-panel"><div className="panel-heading"><h2>Invoices</h2></div><DataTable table="invoices" /></div></div></Page>
}

function Payments() {
  const [customers] = useRows('customers'); const [suppliers] = useRows('suppliers'); const [open, setOpen] = useState(false); const [dir, setDir] = useState<'customer'|'supplier'>('customer'); const [party, setParty] = useState(''); const [amount, setAmount] = useState(''); const [method, setMethod] = useState('upi'); const [ref, setRef] = useState(''); const [notes, setNotes] = useState(''); const [targets, setTargets] = useState<Row[]>([]); const [alloc, setAlloc] = useState<Record<string,string>>({}); const [message, setMessage] = useState(''); const [error, setError] = useState(false)
  const loadTargets = async (d: 'customer'|'supplier', id: string) => { setParty(id); setAlloc({}); if (!id) { setTargets([]); return } if (d === 'customer') { const { data } = await supabase().from('invoices').select('id,business_code,invoice_number,invoice_date,amount_due,status').eq('billing_customer_id', id).gt('amount_due', 0).neq('status', 'cancelled').order('invoice_date'); setTargets(data ?? []); return } const { data: purchases } = await supabase().from('purchases').select('id,business_code,purchase_date,supplier_invoice_number').eq('supplier_id', id).eq('workflow_status', 'completed').order('purchase_date'); const ids = (purchases ?? []).map(x => x.id); if (!ids.length) { setTargets([]); return } const [{ data: pl }, { data: pa }] = await Promise.all([supabase().from('purchase_lines').select('purchase_id,line_total,billed_quantity,unit_rate').in('purchase_id', ids), supabase().from('supplier_payment_allocations').select('purchase_id,amount').in('purchase_id', ids)]); const totals = new Map<string,number>(); (pl ?? []).forEach(x => totals.set(text(x.purchase_id), (totals.get(text(x.purchase_id)) ?? 0) + Number(x.line_total ?? Number(x.billed_quantity ?? 0) * Number(x.unit_rate ?? 0))); (pa ?? []).forEach(x => totals.set(text(x.purchase_id), (totals.get(text(x.purchase_id)) ?? 0) - Number(x.amount ?? 0))); setTargets((purchases ?? []).map(x => ({ ...x, amount_due: Math.max(0, totals.get(text(x.id)) ?? 0) })).filter(x => x.amount_due > 0)) }
  const submit = async () => { const n = Number(amount); if (!party || n <= 0) { setError(true); setMessage('Select the party and enter a positive payment.'); return } const allocations = Object.entries(alloc).filter(([, v]) => Number(v) > 0).map(([id, v]) => dir === 'customer' ? { invoice_id: id, amount: Number(v) } : { purchase_id: id, amount: Number(v) }); const allocated = allocations.reduce((s, x) => s + Number(x.amount), 0); if (allocated > n + 0.000001) { setError(true); setMessage('Allocated amount cannot exceed the payment amount.'); return } const rpc = dir === 'customer' ? 'record_customer_payment_allocated' : 'record_supplier_payment_allocated'; const args = dir === 'customer' ? { p_customer_id: party, p_amount: n, p_payment_date: today(), p_method: method, p_allocations: allocations, p_upi_reference: ref || null, p_notes: notes || null } : { p_supplier_id: party, p_amount: n, p_payment_date: today(), p_method: method, p_allocations: allocations, p_upi_reference: ref || null, p_notes: notes || null }; const { error: e } = await supabase().rpc(rpc, args); if (e) { setError(true); setMessage(e.message); return } setError(false); setMessage(allocated < n ? `Payment recorded. ₹ ${(n - allocated).toFixed(2)} kept as an advance.` : 'Payment recorded and allocated.'); setAmount(''); setRef(''); setNotes(''); await loadTargets(dir, party) }
  return <Page title="Payments" description="One payment can be split across multiple invoices or purchases. Any unallocated balance becomes an explicit advance."><button className="primary-button" onClick={() => setOpen(true)}>+ Record Payment</button>{open && <Modal title={dir === 'customer' ? 'Receive Customer Payment' : 'Pay Supplier'} close={() => setOpen(false)} wide><div className="master-tabs"><button className={dir === 'customer' ? 'tab-active' : ''} onClick={() => { setDir('customer'); setParty(''); setTargets([]); setAlloc({}) }}>Customer Receipt</button><button className={dir === 'supplier' ? 'tab-active' : ''} onClick={() => { setDir('supplier'); setParty(''); setTargets([]); setAlloc({}) }}>Supplier Payment</button></div><Field label={dir === 'customer' ? 'Customer' : 'Supplier'}><Select value={party} onChange={v => loadTargets(dir, v)}><option value="">Select {dir}</option>{(dir === 'customer' ? customers : suppliers).map(x => <option key={text(x.id)} value={text(x.id)}>{text(x.name || x.business_name)} — {text(x.business_code)}</option>)}</Select></Field><div className="form-grid"><Field label="Amount"><input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} /></Field><Field label="Method"><Select value={method} onChange={setMethod}><option value="upi">UPI</option><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="other">Other</option></Select></Field><Field label="Payment reference"><input value={ref} onChange={e => setRef(e.target.value)} /></Field><Field label="Notes"><textarea value={notes} onChange={e => setNotes(e.target.value)} /></Field></div>{party && <><h3>{dir === 'customer' ? 'Open invoices' : 'Open purchases'}</h3>{targets.length ? targets.map(x => <div className="purchase-line" key={text(x.id)}><div className="field"><span>{dir === 'customer' ? 'Invoice' : 'Purchase'}</span><div><strong>{text(x.business_code || x.invoice_number)}</strong> · {text(x.invoice_date || x.purchase_date)}</div></div><Field label="Outstanding"><input value={Number(x.amount_due).toFixed(2)} readOnly /></Field><Field label="Allocate"><input type="number" min="0" step="0.01" max={x.amount_due} value={alloc[text(x.id)] || ''} onChange={e => setAlloc(a => ({ ...a, [text(x.id)]: e.target.value }))} /></Field></div>) : <p className="table-message">No open documents. The payment will be recorded as an advance.</p>}</>}<Status message={message} error={error} /><button className="primary-button" onClick={submit}>Record {dir === 'customer' ? 'Receipt' : 'Payment'}</button></Modal>}<div className="console-grid"><div className="console-panel"><div className="panel-heading"><h2>Customer receipts</h2></div><DataTable table="customer_payments" /></div><div className="console-panel"><div className="panel-heading"><h2>Supplier payments</h2></div><DataTable table="supplier_payments" /></div></div></Page>
}

export default function OperationsConsoleFinal2({ module }: { module: Module }) { if (module === 'orders') return <Orders />; if (module === 'inventory') return <Inventory />; if (module === 'sales') return <Sales />; if (module === 'payments') return <Payments />; return <Production /> }
