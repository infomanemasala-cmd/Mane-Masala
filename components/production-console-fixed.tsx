'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import DataTable from '@/components/data-table'

type R = Record<string, any>
const db = () => createClient()
const s = (v: any) => String(v ?? '')
const n = (v: any) => Number(v ?? 0)

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>
}
function Status({ message, error = false }: { message: string; error?: boolean }) {
  return message ? <p className={`form-status${error ? ' form-status-error' : ''}`} role="alert">{message}</p> : null
}

export default function ProductionConsoleFixed() {
  const [batches, setBatches] = useState<R[]>([])
  const [items, setItems] = useState<R[]>([])
  const [units, setUnits] = useState<R[]>([])
  const [learning, setLearning] = useState<Record<string, R>>({})
  const [open, setOpen] = useState(false)
  const [batchId, setBatchId] = useState('')
  const [selected, setSelected] = useState<R | null>(null)
  const [plan, setPlan] = useState<R[]>([])
  const [output, setOutput] = useState('')
  const [varianceMode, setVarianceMode] = useState<'one_time' | 'permanent'>('one_time')
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)
  const [busy, setBusy] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [batchFilter, setBatchFilter] = useState('')
  const [productFilter, setProductFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [approvalFilter, setApprovalFilter] = useState('')

  const load = async () => {
    const sb = db()
    const [{ data: b }, { data: i }, { data: u }, { data: l }] = await Promise.all([
      sb.from('v_production_batches_list').select('*').order('production_date', { ascending: false }),
      sb.from('items').select('*').eq('is_active', true).order('name'),
      sb.from('units').select('*').eq('is_active', true).order('name'),
      sb.from('v_production_yield_learning').select('*')
    ])
    setBatches(b ?? [])
    setItems(i ?? [])
    setUnits(u ?? [])
    const m: Record<string, R> = {}
    for (const x of l ?? []) m[s(x.recipe_version_id)] = x
    setLearning(m)
  }

  useEffect(() => { void load() }, [])

  const filteredBatches = useMemo(() => batches.filter(b => {
    const d = s(b.production_date)
    return (!dateFrom || d >= dateFrom) &&
      (!dateTo || d <= dateTo) &&
      (!batchFilter || s(b.business_code).toLowerCase().includes(batchFilter.toLowerCase())) &&
      (!productFilter || s(b.output_item_id) === productFilter) &&
      (!statusFilter || s(b.status) === statusFilter) &&
      (!approvalFilter || s(b.wife_approval_status) === approvalFilter)
  }), [batches, dateFrom, dateTo, batchFilter, productFilter, statusFilter, approvalFilter])

  const choose = async (id: string) => {
    setBatchId(id)
    setMessage('')
    setError(false)
    const b = batches.find(x => s(x.id) === id) ?? null
    setSelected(b)
    setOutput(b ? s(b.actual_output_quantity || b.planned_output_quantity) : '')
    setVarianceMode('one_time')
    if (!id) { setPlan([]); return }
    const { data, error: e } = await db().from('production_batch_plan_lines').select('id,ingredient_item_id,planned_quantity,unit_id').eq('production_batch_id', id).order('id')
    if (e) { setError(true); setMessage(e.message); setPlan([]); return }
    setPlan((data ?? []).map(x => ({ id: x.id, itemId: s(x.ingredient_item_id), unitId: s(x.unit_id), planned: n(x.planned_quantity), actual: '' })))
  }

  const approve = async () => {
    if (!batchId) return
    setBusy(true)
    const { error: e } = await db().rpc('approve_production_batch', { p_production_batch_id: batchId })
    setBusy(false)
    if (e) { setError(true); setMessage(e.message); return }
    setError(false); setMessage('Production plan approved by wife.'); await load(); setSelected(p => p ? { ...p, wife_approval_status: 'approved' } : p); setRefreshToken(v => v + 1)
  }

  const start = async () => {
    if (!batchId) return
    setBusy(true)
    const { error: e } = await db().rpc('start_production_batch', { p_production_batch_id: batchId })
    setBusy(false)
    if (e) { setError(true); setMessage(e.message); return }
    setError(false); setMessage('Production started. Reserved ingredients are issued to this batch.'); await load(); setSelected(p => p ? { ...p, status: 'in_progress' } : p); setRefreshToken(v => v + 1)
  }

  const complete = async () => {
    if (!selected) return
    const consumptions = plan.filter(x => n(x.actual) > 0).map(x => ({ ingredient_item_id: x.itemId, actual_quantity: n(x.actual), unit_id: x.unitId }))
    if (consumptions.length !== plan.length || n(output) <= 0) { setError(true); setMessage('Enter an actual quantity for every ingredient and the actual finished output.'); return }
    const hasVariance = plan.some(x => Math.abs(n(x.actual) - n(x.planned)) > 0.000001) || Math.abs(n(output) - n(selected.planned_output_quantity)) > 0.000001
    setBusy(true)
    const { error: e } = await db().rpc('complete_production_with_learning', {
      p_production_batch_id: batchId,
      p_consumptions: consumptions,
      p_outputs: [{ output_item_id: selected.output_item_id, quantity: n(output), unit_id: selected.output_unit_id }],
      p_variance_mode: hasVariance ? varianceMode : 'one_time'
    })
    setBusy(false)
    if (e) { setError(true); setMessage(e.message); return }
    setError(false); setMessage(varianceMode === 'permanent' && hasVariance ? 'Production completed and a new recipe version was saved from the actual result.' : 'Production completed; actual consumption and output were recorded for future estimates.')
    await load(); setRefreshToken(v => v + 1); setOpen(false)
  }

  const itemName = (id: string) => s(items.find(i => s(i.id) === id)?.name || id)
  const itemCode = (id: string) => s(items.find(i => s(i.id) === id)?.item_code || items.find(i => s(i.id) === id)?.business_code || '')
  const unitName = (id: string) => s(units.find(u => s(u.id) === id)?.symbol || units.find(u => s(u.id) === id)?.name || '')
  const learn = learning[s(selected?.recipe_version_id)]
  const planned = n(selected?.planned_output_quantity)
  const standard = n(learn?.recipe_expected_output || planned)
  const learnedEstimate = standard > 0 ? n(learn?.learned_expected_output || standard) * planned / standard : planned

  return <section className="page-panel">
    <div className="section-label">Mane Masala</div>
    <div className="master-header"><div><h1>Production</h1><p className="page-intro">Review, filter and operate production by date, batch, product, status and wife approval. Each batch remains linked to its order and order line.</p></div><button className="primary-button" type="button" onClick={() => { setOpen(true); setMessage(''); setError(false) }}>+ Review Production</button></div>

    <div className="console-panel">
      <div className="panel-heading"><div><h2>Production filters</h2><span>Use any combination. Clear filters to see the full production queue.</span></div><span className="status-pill">{filteredBatches.length} / {batches.length}</span></div>
      <div className="form-grid">
        <Field label="From date"><input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></Field>
        <Field label="To date"><input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} /></Field>
        <Field label="Batch"><input value={batchFilter} placeholder="Batch code" onChange={e => setBatchFilter(e.target.value)} /></Field>
        <Field label="Product"><select value={productFilter} onChange={e => setProductFilter(e.target.value)}><option value="">All products</option>{items.map(i => <option key={s(i.id)} value={s(i.id)}>{s(i.business_code || i.item_code)} — {s(i.name)}</option>)}</select></Field>
        <Field label="Status"><select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="">All statuses</option>{['planned','in_progress','completed','cancelled'].map(v => <option key={v} value={v}>{v}</option>)}</select></Field>
        <Field label="Wife approval"><select value={approvalFilter} onChange={e => setApprovalFilter(e.target.value)}><option value="">All approval states</option>{['pending','approved','rejected'].map(v => <option key={v} value={v}>{v}</option>)}</select></Field>
      </div>
      <div className="workflow-actions"><button className="secondary-button" type="button" onClick={() => { setDateFrom(''); setDateTo(''); setBatchFilter(''); setProductFilter(''); setStatusFilter(''); setApprovalFilter('') }}>Clear filters</button></div>
    </div>

    {open && <div className="modal-backdrop"><div className="modal-card purchase-modal"><div className="modal-header"><h3>Production batch — review & completion</h3><button className="secondary-button" type="button" onClick={() => setOpen(false)}>Close</button></div>
      <Field label="Production batch"><select value={batchId} onChange={e => choose(e.target.value)}><option value="">Select production batch...</option>{filteredBatches.filter(b => s(b.status) !== 'completed').map(b => <option key={s(b.id)} value={s(b.id)}>{s(b.business_code)} — {s(b.output_item_name)} — {s(b.production_date)} — {s(b.status)} / {s(b.wife_approval_status)}</option>)}</select></Field>
      {selected && <>
        <div className="plan-summary"><div><small>Order</small><strong>{s(selected.order_code)}</strong></div><div><small>Order line</small><strong>{s(selected.order_line_id)}</strong></div><div><small>Recipe</small><strong>v{s(selected.recipe_version)}</strong></div><div><small>Production date</small><strong>{s(selected.production_date)}</strong></div></div>
        <div className="plan-summary"><div><small>Production target</small><strong>{planned} {unitName(s(selected.output_unit_id))}</strong></div><div><small>Recipe standard</small><strong>{standard} {unitName(s(selected.output_unit_id))}</strong></div><div><small>Learned expected output</small><strong>{learnedEstimate.toFixed(3)} {unitName(s(selected.output_unit_id))}</strong></div><div><small>Learning sample</small><strong>{n(learn?.completed_batches || 0)}</strong></div></div>
        <div className="console-panel"><div className="panel-heading"><h3>Ingredients — planned vs actual</h3><span>Actual values are required for completion.</span></div><div className="table-wrap"><table className="production-plan-table"><thead><tr><th>Ingredient</th><th>Planned</th><th>Unit</th><th>Actual</th></tr></thead><tbody>{plan.map((p, i) => <tr key={s(p.id)}><td><strong>{itemCode(p.itemId)}</strong> — {itemName(p.itemId)}</td><td className="num">{p.planned}</td><td>{unitName(p.unitId)}</td><td><input aria-label={`Actual quantity for ${itemName(p.itemId)}`} type="number" min="0" step="0.001" value={p.actual} placeholder="0.000" onChange={e => setPlan(v => v.map((z, j) => j === i ? { ...z, actual: e.target.value } : z))} /></td></tr>)}</tbody></table></div></div>
        <div className="form-grid"><Field label={`Actual finished output (${unitName(s(selected.output_unit_id))})`}><input type="number" min="0" step="0.001" value={output} placeholder="0.000" onChange={e => setOutput(e.target.value)} /></Field><Field label="Wife approval"><input value={s(selected.wife_approval_status)} readOnly /></Field></div>
        {(plan.some(x => Math.abs(n(x.actual) - n(x.planned)) > 0.000001) || Math.abs(n(output) - planned) > 0.000001) && <div className="console-panel"><div className="panel-heading"><h3>Production variance</h3><span>Choose whether this result is batch-specific or becomes the next recipe version.</span></div><Field label="Variance treatment"><select value={varianceMode} onChange={e => setVarianceMode(e.target.value as 'one_time' | 'permanent')}><option value="one_time">One time — this batch only</option><option value="permanent">Permanent — save new recipe version</option></select></Field></div>}
        <Status message={message} error={error} /><div className="workflow-actions">{selected.wife_approval_status !== 'approved' && <button className="secondary-button" type="button" disabled={busy} onClick={approve}>Wife approve production plan</button>}{selected.wife_approval_status === 'approved' && selected.status === 'planned' && <button className="secondary-button" type="button" disabled={busy} onClick={start}>Start / issue production</button>}{selected.status === 'in_progress' && <button className="primary-button" type="button" disabled={busy} onClick={complete}>{busy ? 'Saving…' : 'Complete production'}</button>}</div>
      </>}
    </div></div>}

    <div className="console-panel"><div className="panel-heading"><h2>Filtered production batches</h2><span>Open a batch from this exact filtered set.</span></div><DataTable table="v_production_batches_list" refreshToken={refreshToken} linkColumns={['business_code']} /></div>
  </section>
}
