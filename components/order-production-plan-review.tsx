'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Row = Record<string, any>
const db = () => createClient()
const txt = (v: any) => String(v ?? '')
const num = (v: any) => Number(v ?? 0)

export default function OrderProductionPlanReview() {
  const [batches, setBatches] = useState<Row[]>([])
  const [plans, setPlans] = useState<Record<string, Row[]>>({})
  const [recipes, setRecipes] = useState<Record<string, Row[]>>({})
  const [learning, setLearning] = useState<Record<string, Row>>({})
  const [items, setItems] = useState<Row[]>([])
  const [units, setUnits] = useState<Row[]>([])
  const [selectedRecipe, setSelectedRecipe] = useState<Record<string, string>>({})
  const [extraItem, setExtraItem] = useState<Record<string, string>>({})
  const [extraQty, setExtraQty] = useState<Record<string, string>>({})
  const [mode, setMode] = useState<Record<string, 'one_time' | 'permanent'>>({})
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const load = async () => {
    const sb = db()
    const [{ data: bs, error: be }, { data: its }, { data: us }, { data: rs }, { data: ls }] = await Promise.all([
      sb.from('v_production_batches_list').select('*').in('status', ['planned', 'in_progress']).order('production_date'),
      sb.from('items').select('*').eq('is_active', true).order('name'),
      sb.from('units').select('*').order('name'),
      sb.from('recipe_versions').select('id,recipe_id,version_number,status,expected_output_quantity,output_unit_id,recipes!inner(id,name,output_item_id,status)').eq('status', 'active'),
      sb.from('v_production_yield_learning').select('*'),
    ])
    if (be) { setError(true); setMessage(be.message); return }
    setBatches(bs ?? [])
    setItems(its ?? [])
    setUnits(us ?? [])
    const recipeMap: Record<string, Row[]> = {}
    for (const r of rs ?? []) {
      if (r.recipes?.status !== 'active') continue
      const key = txt(r.recipes.output_item_id)
      recipeMap[key] = [...(recipeMap[key] ?? []), r]
    }
    setRecipes(recipeMap)
    const learnMap: Record<string, Row> = {}
    for (const l of ls ?? []) learnMap[txt(l.recipe_version_id)] = l
    setLearning(learnMap)
    const ids = (bs ?? []).map((b: Row) => txt(b.id))
    if (!ids.length) { setPlans({}); return }
    const { data: pls, error: pe } = await sb.from('production_batch_plan_lines').select('id,production_batch_id,recipe_line_id,ingredient_item_id,planned_quantity,unit_id').in('production_batch_id', ids).order('id')
    if (pe) { setError(true); setMessage(pe.message); return }
    const map: Record<string, Row[]> = {}
    for (const p of pls ?? []) map[txt(p.production_batch_id)] = [...(map[txt(p.production_batch_id)] ?? []), p]
    setPlans(map)
    setSelectedRecipe(prev => {
      const next = { ...prev }
      for (const b of bs ?? []) if (!next[txt(b.id)]) next[txt(b.id)] = txt(b.recipe_version_id)
      return next
    })
  }

  useEffect(() => { void load() }, [])

  const revise = async (b: Row) => {
    const id = txt(b.id)
    const extra = extraItem[id] && num(extraQty[id]) > 0 ? [{ ingredient_item_id: extraItem[id], quantity: num(extraQty[id]), unit_id: txt(items.find(i => txt(i.id) === extraItem[id])?.base_unit_id) }] : []
    if (extra.length && !extra[0].unit_id) { setError(true); setMessage('The additional raw material has no base unit configured.'); return }
    const permanent = mode[id] === 'permanent'
    if (permanent && !extra.length && selectedRecipe[id] === txt(b.recipe_version_id)) { setError(true); setMessage('For a permanent change, choose a different recipe or add an ingredient.'); return }
    setBusy(id); setError(false); setMessage('')
    const { error: e } = await db().rpc('revise_production_plan', { p_production_batch_id: b.id, p_recipe_version_id: selectedRecipe[id] || b.recipe_version_id, p_additional_ingredients: extra, p_permanent_recipe_change: permanent })
    setBusy(null)
    if (e) { setError(true); setMessage(e.message); return }
    setMessage(permanent ? 'New recipe version saved and applied to this production plan.' : 'This production plan was updated for this batch only.')
    setExtraItem(v => ({ ...v, [id]: '' })); setExtraQty(v => ({ ...v, [id]: '' })); await load()
  }

  const approve = async (b: Row) => {
    setBusy(txt(b.id)); const { error: e } = await db().rpc('approve_production_batch', { p_production_batch_id: b.id }); setBusy(null)
    if (e) { setError(true); setMessage(e.message); return }
    setError(false); setMessage(`${txt(b.business_code)} approved by wife. The order can be confirmed when all required production batches are approved.`); await load()
  }

  const confirm = async (orderId: string, orderCode: string) => {
    setBusy(orderId); const { error: e } = await db().rpc('confirm_order', { p_order_id: orderId }); setBusy(null)
    if (e) { setError(true); setMessage(e.message); return }
    setError(false); setMessage(`${orderCode} confirmed. Production can now be started.`); await load()
  }

  const itemName = (id: string) => txt(items.find(i => txt(i.id) === id)?.name || id)
  const unitName = (id: string) => txt(units.find(u => txt(u.id) === id)?.name || '')

  const grouped: Record<string, Row[]> = {}
  for (const b of batches) grouped[txt(b.order_id)] = [...(grouped[txt(b.order_id)] ?? []), b]

  return <section className="console-panel">
    <div className="panel-heading"><div><h2>Production Plan — Wife Review</h2><p className="page-intro">Review the recipe, ingredients and estimated output before approving the order.</p></div></div>
    {message && <p className={`form-status${error ? ' form-status-error' : ''}`} role="alert">{message}</p>}
    {!batches.length && <p className="table-message">No pending production plans.</p>}
    {Object.entries(grouped).map(([orderId, orderBatches]) => {
      const allApproved = orderBatches.every(b => txt(b.wife_approval_status) === 'approved')
      return <div className="console-panel" key={orderId}>
        <div className="panel-heading"><h3>Order {txt(orderBatches[0].order_code)}</h3><span>{allApproved ? 'Production plan approved' : 'Wife approval pending'}</span></div>
        {orderBatches.map(b => {
          const id = txt(b.id)
          const versionId = selectedRecipe[id] || txt(b.recipe_version_id)
          const optionList = recipes[txt(b.output_item_id)] ?? []
          const learningRow = learning[versionId]
          const planned = num(b.planned_output_quantity)
          const recipeExpected = num(learningRow?.recipe_expected_output || b.planned_output_quantity)
          const learnedBatchEstimate = recipeExpected > 0 ? num(learningRow?.learned_expected_output || recipeExpected) * planned / recipeExpected : planned
          const pending = txt(b.wife_approval_status) !== 'approved'
          return <div className="console-panel" key={id}>
            <div className="form-grid">
              <label className="field"><span>Production batch</span><input value={txt(b.business_code)} readOnly /></label>
              <label className="field"><span>Order item</span><input value={`${txt(b.output_item_code)} — ${txt(b.output_item_name)}`} readOnly /></label>
              <label className="field"><span>Recipe</span><select value={versionId} onChange={e => setSelectedRecipe(v => ({ ...v, [id]: e.target.value }))}>{optionList.map((r: Row) => <option key={txt(r.id)} value={txt(r.id)}>{txt(r.recipes?.name)} — v{txt(r.version_number)}</option>)}</select></label>
              <label className="field"><span>Recipe standard expected output</span><input value={`${recipeExpected} ${unitName(txt(b.output_unit_id))}`} readOnly /></label>
              <label className="field"><span>Production target</span><input value={`${planned} ${unitName(txt(b.output_unit_id))}`} readOnly /></label>
              <label className="field"><span>Learned expected output</span><input value={`${learnedBatchEstimate.toFixed(3)} ${unitName(txt(b.output_unit_id))}`} readOnly /></label>
              <label className="field"><span>Learning sample</span><input value={`${txt(learningRow?.completed_batches || 0)} completed batch${num(learningRow?.completed_batches) === 1 ? '' : 'es'} · ${txt(learningRow?.learned_yield_percent || '100')}% learned yield`} readOnly /></label>
              <label className="field"><span>Wife approval</span><input value={txt(b.wife_approval_status)} readOnly /></label>
            </div>
            <div className="console-panel"><div className="panel-heading"><h4>Ingredients</h4><span>Planned quantities are estimates; actual consumption is entered at completion.</span></div>{(plans[id] ?? []).map(p => <div className="workflow-row" key={txt(p.id)}><div><strong>{itemName(txt(p.ingredient_item_id))}</strong><span>{num(p.planned_quantity)} {unitName(txt(p.unit_id))}</span></div></div>)}</div>
            {pending && <>
              <div className="console-panel"><div className="panel-heading"><h4>Change recipe or add raw material</h4></div><div className="form-grid">
                <label className="field"><span>Additional raw material</span><select value={extraItem[id] || ''} onChange={e => setExtraItem(v => ({ ...v, [id]: e.target.value }))}><option value="">None</option>{items.filter(i => i.can_be_used_in_production !== false && txt(i.id) !== txt(b.output_item_id)).map(i => <option key={txt(i.id)} value={txt(i.id)}>{txt(i.item_code)} — {txt(i.name)}</option>)}</select></label>
                <label className="field"><span>Additional quantity for this production plan</span><input type="number" min="0" step="0.001" value={extraQty[id] || ''} onChange={e => setExtraQty(v => ({ ...v, [id]: e.target.value }))} /></label>
                <label className="field"><span>Change treatment</span><select value={mode[id] || 'one_time'} onChange={e => setMode(v => ({ ...v, [id]: e.target.value as 'one_time' | 'permanent' }))}><option value="one_time">One time — this batch only</option><option value="permanent">Permanent — save as new recipe version</option></select></label>
              </div><div className="button-row"><button className="secondary-button" type="button" disabled={busy === id} onClick={() => revise(b)}>{busy === id ? 'Saving…' : mode[id] === 'permanent' ? 'Save new recipe & update plan' : 'Update this plan only'}</button></div></div>
              <div className="button-row"><button className="primary-button" type="button" disabled={busy === id} onClick={() => approve(b)}>{busy === id ? 'Saving…' : 'Wife approve production plan'}</button></div>
            </>}
          </div>
        })}
        {allApproved && <div className="button-row"><button className="primary-button" type="button" disabled={busy === orderId} onClick={() => confirm(orderId, txt(orderBatches[0].order_code))}>{busy === orderId ? 'Saving…' : 'Confirm order'}</button></div>}
      </div>
    })}
  </section>
}
