'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import DataTable from '@/components/data-table'

type Row = Record<string, any>
const sb = () => createClient()
const txt = (v: any) => String(v ?? '')

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>
}
function Select({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: ReactNode }) {
  return <select value={value} onChange={e => onChange(e.target.value)}>{children}</select>
}
function Status({ message, error = false }: { message: string; error?: boolean }) {
  return message ? <p className={`form-status${error ? ' form-status-error' : ''}`} role="alert">{message}</p> : null
}
function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  return <div className="modal-backdrop"><div className="modal-card purchase-modal"><div className="modal-header"><h3>{title}</h3><button className="secondary-button" type="button" onClick={close}>Close</button></div>{children}</div></div>
}

export default function ProductionConsoleFixed() {
  const [batches, setBatches] = useState<Row[]>([])
  const [open, setOpen] = useState(false)
  const [batchId, setBatchId] = useState('')
  const [selected, setSelected] = useState<Row | null>(null)
  const [plan, setPlan] = useState<any[]>([])
  const [output, setOutput] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)

  const load = async () => {
    const { data } = await sb().from('v_production_batches_list').select('*').order('production_date', { ascending: false })
    setBatches(data ?? [])
  }
  useEffect(() => { void load() }, [])

  const choose = async (id: string) => {
    setBatchId(id)
    setMessage('')
    setError(false)
    const batch = batches.find(x => txt(x.id) === id) ?? null
    setSelected(batch)
    setOutput(txt(batch?.planned_output_quantity))
    if (!id) { setPlan([]); return }
    const { data, error: e } = await sb().from('production_batch_plan_lines').select('id,ingredient_item_id,planned_quantity,unit_id').eq('production_batch_id', id).order('id')
    if (e) { setError(true); setMessage(e.message); setPlan([]); return }
    setPlan((data ?? []).map(x => ({ id: x.id, itemId: txt(x.ingredient_item_id), unitId: txt(x.unit_id), planned: Number(x.planned_quantity), actual: Number(x.planned_quantity) })))
  }

  const approve = async () => {
    if (!batchId) return
    const { error: e } = await sb().rpc('approve_production_batch', { p_production_batch_id: batchId })
    if (e) { setError(true); setMessage(e.message); return }
    setError(false); setMessage('Production batch approved.'); await load(); setRefreshToken(v => v + 1)
    setSelected(prev => prev ? { ...prev, wife_approval_status: 'approved' } : prev)
  }

  const start = async () => {
    if (!batchId) return
    const { error: e } = await sb().rpc('start_production_batch', { p_production_batch_id: batchId })
    if (e) { setError(true); setMessage(e.message); return }
    setError(false); setMessage('Production started. Reserved ingredients are now being used for this batch.'); await load(); setRefreshToken(v => v + 1)
    setSelected(prev => prev ? { ...prev, status: 'in_progress' } : prev)
  }

  const complete = async () => {
    if (!selected) return
    const consumptions = plan.filter(x => x.actual > 0).map(x => ({ ingredient_item_id: x.itemId, actual_quantity: Number(x.actual), unit_id: x.unitId }))
    if (!consumptions.length || Number(output) <= 0) { setError(true); setMessage('Actual ingredient consumption and output are required.'); return }
    const { error: e } = await sb().rpc('complete_production', {
      p_production_batch_id: batchId,
      p_consumptions: consumptions,
      p_outputs: [{ output_item_id: selected.output_item_id, quantity: Number(output), unit_id: selected.output_unit_id }],
    })
    if (e) { setError(true); setMessage(e.message); return }
    setError(false); setMessage('Production completed. Ingredient stock was consumed FIFO and output stock was created.'); await load(); setRefreshToken(v => v + 1); setOpen(false)
  }

  return <section className="page-panel">
    <div className="section-label">Mane Masala</div>
    <div className="master-header"><div><h1>Production</h1><p className="page-intro">Order-linked production shows the recipe version, planned ingredients, actual consumption and batch output. Wife approval is required before production starts.</p></div><button className="primary-button" type="button" onClick={() => { setOpen(true); setMessage(''); setError(false) }}>+ Review Production</button></div>
    {open && <Modal title="Production batch" close={() => setOpen(false)}>
      <Field label="Production batch"><Select value={batchId} onChange={choose}><option value="">Select batch</option>{batches.filter(b => txt(b.status) !== 'completed').map(b => <option key={txt(b.id)} value={txt(b.id)}>{txt(b.business_code)} — {txt(b.output_item_name)} — {txt(b.status)} / {txt(b.wife_approval_status)}</option>)}</Select></Field>
      {selected && <>
        <div className="form-grid"><Field label="Order"><input value={txt(selected.order_code)} readOnly /></Field><Field label="Recipe version"><input value={selected.recipe_version == null ? '' : `v${selected.recipe_version}`} readOnly /></Field><Field label="Planned output"><input value={txt(selected.planned_output_quantity)} readOnly /></Field><Field label="Actual output"><input type="number" min="0" step="0.001" value={output} onChange={e => setOutput(e.target.value)} /></Field></div>
        <div className="console-panel"><div className="panel-heading"><h2>Ingredients</h2></div>{plan.map((p, i) => <div className="purchase-line" key={txt(p.id)}><Field label="Ingredient"><input value={txt(p.itemId)} readOnly /></Field><Field label="Planned"><input value={String(p.planned)} readOnly /></Field><Field label="Actual"><input type="number" min="0" step="0.001" value={p.actual} onChange={e => setPlan(x => x.map((z, n) => n === i ? { ...z, actual: Number(e.target.value) } : z))} /></Field></div>)}</div>
        <Status message={message} error={error}/>
        {selected.wife_approval_status !== 'approved' && <button className="secondary-button" type="button" onClick={approve}>Approve production</button>}
        {selected.wife_approval_status === 'approved' && selected.status === 'planned' && <button className="secondary-button" type="button" onClick={start}>Start production</button>}
        {selected.status === 'in_progress' && <button className="primary-button" type="button" onClick={complete}>Complete production</button>}
      </>}
    </Modal>}
    <div className="console-panel"><div className="panel-heading"><h2>Production batches</h2></div><DataTable table="v_production_batches_list" refreshToken={refreshToken}/></div>
  </section>
}
