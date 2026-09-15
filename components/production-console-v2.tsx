'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import DataTable from '@/components/data-table'

type Row = Record<string, any>
const db = () => createClient()
const txt = (v: any) => String(v ?? '')

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="field"><span>{label}</span>{children}</label> }
function Status({ message, error }: { message: string; error: boolean }) { return message ? <p className={`form-status${error ? ' form-status-error' : ''}`} role="alert">{message}</p> : null }
function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) { return <div className="modal-backdrop"><div className="modal-card purchase-modal"><div className="modal-header"><h3>{title}</h3><button className="secondary-button" type="button" onClick={close}>Close</button></div>{children}</div></div> }

export default function ProductionConsoleV2() {
  const [batches, setBatches] = useState<Row[]>([])
  const [itemId, setItemId] = useState('')
  const [date, setDate] = useState('')
  const [status, setStatus] = useState('')
  const [open, setOpen] = useState(false)
  const [batchId, setBatchId] = useState('')
  const [selected, setSelected] = useState<Row | null>(null)
  const [plan, setPlan] = useState<Row[]>([])
  const [output, setOutput] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)

  const load = async () => {
    const { data } = await db().from('v_production_batches_list').select('*').order('production_date', { ascending: false }).order('created_at', { ascending: false })
    setBatches(data ?? [])
  }
  useEffect(() => { void load() }, [])

  const items = useMemo(() => Array.from(new Map(batches.map(b => [txt(b.output_item_id), { id: txt(b.output_item_id), name: txt(b.output_item_name) }])).values()).filter(x => x.id), [batches])
  const filtered = useMemo(() => batches.filter(b => (!itemId || txt(b.output_item_id) === itemId) && (!date || txt(b.production_date) === date) && (!status || txt(b.status) === status)), [batches, itemId, date, status])

  const choose = async (id: string) => {
    setBatchId(id); setMessage(''); setError(false)
    const batch = batches.find(x => txt(x.id) === id) ?? null
    setSelected(batch); setOutput(txt(batch?.planned_output_quantity))
    if (!id) { setPlan([]); return }
    const { data, error: e } = await db().from('production_batch_plan_lines').select('id,ingredient_item_id,planned_quantity,unit_id').eq('production_batch_id', id).order('id')
    if (e) { setError(true); setMessage(e.message); setPlan([]); return }
    setPlan((data ?? []).map(x => ({ ...x, itemId: txt(x.ingredient_item_id), unitId: txt(x.unit_id), planned: Number(x.planned_quantity), actual: Number(x.planned_quantity) })))
  }
  const approve = async () => { if (!batchId) return; const { error: e } = await db().rpc('approve_production_batch', { p_production_batch_id: batchId }); if (e) { setError(true); setMessage(e.message); return } setError(false); setMessage('Production batch approved.'); await load(); setRefreshToken(v => v + 1); setSelected(v => v ? { ...v, wife_approval_status: 'approved' } : v) }
  const start = async () => { if (!batchId) return; const { error: e } = await db().rpc('start_production_batch', { p_production_batch_id: batchId }); if (e) { setError(true); setMessage(e.message); return } setError(false); setMessage('Production started.'); await load(); setRefreshToken(v => v + 1); setSelected(v => v ? { ...v, status: 'in_progress' } : v) }
  const complete = async () => { if (!selected) return; const consumptions = plan.filter(x => Number(x.actual) > 0).map(x => ({ ingredient_item_id: x.itemId, actual_quantity: Number(x.actual), unit_id: x.unitId })); if (!consumptions.length || Number(output) <= 0) { setError(true); setMessage('Actual ingredient consumption and actual output are required.'); return } const { error: e } = await db().rpc('complete_production', { p_production_batch_id: batchId, p_consumptions: consumptions, p_outputs: [{ output_item_id: selected.output_item_id, quantity: Number(output), unit_id: selected.output_unit_id }] }); if (e) { setError(true); setMessage(e.message); return } setError(false); setMessage('Production completed. FIFO ingredient consumption and output stock were recorded.'); await load(); setRefreshToken(v => v + 1); setOpen(false) }

  return <section className="page-panel"><div className="section-label">Mane Masala</div><div className="master-header"><div><h1>Production</h1><p className="page-intro">Review production by batch, item, date or status. Select a batch to approve, start and complete its order-linked production flow.</p></div><button className="primary-button" type="button" onClick={() => { setOpen(true); setMessage(''); setError(false) }}>+ Review Production</button></div><div className="console-panel"><div className="panel-heading"><h2>Review filters</h2></div><div className="form-grid"><Field label="By Item"><select value={itemId} onChange={e => setItemId(e.target.value)}><option value="">All items</option>{items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select></Field><Field label="By Date"><input type="date" value={date} onChange={e => setDate(e.target.value)} /></Field><Field label="By Status"><select value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option><option value="planned">Planned</option><option value="approved">Approved</option><option value="in_progress">In progress</option><option value="partially_completed">Partially completed</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></Field><Field label="Review scope"><input value={`${filtered.length} matching batch${filtered.length === 1 ? '' : 'es'}`} readOnly /></Field></div><button className="secondary-button" type="button" onClick={() => { setItemId(''); setDate(''); setStatus('') }}>Clear filters</button></div><div className="console-panel"><div className="panel-heading"><h2>Production batches</h2></div><DataTable table="v_production_batches_list" refreshToken={refreshToken}/><p className="muted">The filters above are for quick review; the table remains fully searchable, sortable and paginated.</p></div>{open&&<Modal title="Review Production" close={()=>setOpen(false)}><Field label="Production batch"><select value={batchId} onChange={e=>choose(e.target.value)}><option value="">Select batch</option>{filtered.filter(b=>txt(b.status)!=='completed'&&txt(b.status)!=='cancelled').map(b=><option key={txt(b.id)} value={txt(b.id)}>{txt(b.business_code)} — {txt(b.output_item_name)} — {txt(b.production_date)} — {txt(b.status)}</option>)}</select></Field>{selected&&<><div className="form-grid"><Field label="Order"><input value={txt(selected.order_code)} readOnly/></Field><Field label="Item"><input value={txt(selected.output_item_name)} readOnly/></Field><Field label="Recipe version"><input value={selected.recipe_version==null?'':`v${selected.recipe_version}`} readOnly/></Field><Field label="Planned output"><input value={txt(selected.planned_output_quantity)} readOnly/></Field><Field label="Actual output"><input type="number" min="0" step="0.001" value={output} onChange={e=>setOutput(e.target.value)}/></Field><Field label="Approval"><input value={txt(selected.wife_approval_status)} readOnly/></Field></div><div className="console-panel"><div className="panel-heading"><h2>Ingredients</h2></div>{plan.map((p,i)=><div className="purchase-line" key={txt(p.id)}><Field label="Ingredient"><input value={txt(p.itemId)} readOnly/></Field><Field label="Planned"><input value={String(p.planned)} readOnly/></Field><Field label="Actual"><input type="number" min="0" step="0.001" value={p.actual} onChange={e=>setPlan(v=>v.map((x,n)=>n===i?{...x,actual:Number(e.target.value)}:x))}/></Field></div>)}</div><Status message={message} error={error}/><div className="purchase-actions">{selected.wife_approval_status!=='approved'&&<button className="secondary-button" type="button" onClick={approve}>Approve production</button>}{selected.wife_approval_status==='approved'&&selected.status==='planned'&&<button className="secondary-button" type="button" onClick={start}>Start production</button>}{selected.status==='in_progress'&&<button className="primary-button" type="button" onClick={complete}>Complete production</button>}<button className="secondary-button" type="button" onClick={()=>setOpen(false)}>Close</button></div></>}</Modal>}</section>
}
