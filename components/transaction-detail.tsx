'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Row = Record<string, any>
const db = () => createClient()
const txt = (v:any) => String(v ?? '')
const label = (k:string) => k.replaceAll('_',' ').replace(/\b\w/g, l => l.toUpperCase())

export default function TransactionDetail({ table, id }: { table:string; id:string }) {
  const [row,setRow] = useState<Row|null>(null), [plan,setPlan] = useState<Row[]>([]), [message,setMessage] = useState(''), [error,setError] = useState(false), [busy,setBusy] = useState(false)
  const [actualOutput,setActualOutput] = useState('')
  const [actuals,setActuals] = useState<Record<string,string>>({})
  const load = async () => {
    const key = table === 'v_inventory_current' ? 'item_id' : 'id'
    const source = table === 'v_purchases_list' ? 'purchases' : table
    const {data,error:e} = await db().from(source).select('*').eq(key,id).single()
    if(e){setError(true);setMessage(e.message);return}
    setRow(data)
    if(table==='production_batches' || table==='v_production_batches_list'){
      setActualOutput(txt(data?.planned_output_quantity))
      const {data:p} = await db().from('production_batch_plan_lines').select('id,ingredient_item_id,planned_quantity,unit_id').eq('production_batch_id',id).order('id')
      setPlan(p??[]); setActuals(Object.fromEntries((p??[]).map(x=>[txt(x.id),txt(x.planned_quantity)])))
    }
  }
  useEffect(()=>{void load()},[table,id])
  const action = async (rpc:string,args:Row) => { setBusy(true);setError(false);setMessage('');const {error:e}=await db().rpc(rpc,args);setBusy(false);if(e){setError(true);setMessage(e.message);return}setMessage('Action completed successfully.');await load() }
  const productionAction = useMemo(()=>{
    if(!row) return null
    if(txt(row.wife_approval_status)!=='approved') return {label:'Wife approve production plan',rpc:'approve_production_batch',args:{p_production_batch_id:id}}
    if(txt(row.status)==='planned') return {label:'Start production',rpc:'start_production_batch',args:{p_production_batch_id:id}}
    if(txt(row.status)==='in_progress') return {label:'Complete production',rpc:'complete_production',args:{p_production_batch_id:id,p_consumptions:plan.filter(p=>Number(actuals[txt(p.id)]||0)>0).map(p=>({ingredient_item_id:p.ingredient_item_id,actual_quantity:Number(actuals[txt(p.id)]),unit_id:p.unit_id})),p_outputs:[{output_item_id:row.output_item_id,quantity:Number(actualOutput),unit_id:row.output_unit_id}]}}
    return null
  },[row,id,plan,actuals,actualOutput])
  if(!row) return <section className="page-panel"><p>{message||'Loading transaction…'}</p></section>
  const fields = Object.entries(row).filter(([k])=>!['id','created_at','updated_at','created_by','approved_by','confirmed_by'].includes(k))
  return <section className="page-panel">
    <div className="master-header"><div><div className="section-label">Mane Masala</div><h1>{txt(row.business_code) || 'Transaction'}</h1><p className="page-intro">Complete transaction record and available next actions.</p></div><Link className="secondary-button" href={table.startsWith('v_order')||table==='orders'?'/orders':table.includes('purchase')?'/purchases':table.includes('production')?'/production':table.includes('payment')?'/payments':table.includes('invoice')||table==='sales'?'/sales-invoices':'/inventory'}>Back to list</Link></div>
    <div className="console-panel"><div className="panel-heading"><h2>Transaction details</h2></div><div className="form-grid">{fields.map(([k,v])=><div className="field" key={k}><span>{label(k)}</span><input value={typeof v==='object'&&v!==null?JSON.stringify(v):txt(v)} readOnly /></div>)}</div></div>
    {productionAction && <div className="console-panel"><div className="panel-heading"><h2>Next action</h2></div>{(table==='production_batches'||table==='v_production_batches_list')&&<><div className="form-grid"><div className="field"><span>Actual output</span><input type="number" min="0" step="0.001" value={actualOutput} onChange={e=>setActualOutput(e.target.value)} /></div></div>{plan.map(p=><div className="purchase-line" key={txt(p.id)}><div className="field"><span>Ingredient</span><input value={txt(p.ingredient_item_id)} readOnly /></div><div className="field"><span>Planned</span><input value={txt(p.planned_quantity)} readOnly /></div><div className="field"><span>Actual</span><input type="number" min="0" step="0.001" value={actuals[txt(p.id)]||''} onChange={e=>setActuals(x=>({...x,[txt(p.id)]:e.target.value}))} /></div></div>)}</>}<button className="primary-button" type="button" disabled={busy} onClick={()=>void action(productionAction.rpc,productionAction.args)}>{busy?'Processing…':productionAction.label}</button></div>}
    {(table==='purchases'||table==='v_purchases_list') && <div className="console-panel"><div className="panel-heading"><h2>Purchase actions</h2></div>{txt(row.workflow_status)==='inspected_stock'&&<button className="primary-button" type="button" disabled={busy} onClick={()=>void action('complete_purchase_inspection',{p_purchase_id:id})}>{busy?'Processing…':'Complete purchase inspection'}</button>}<Link className="secondary-button" href="/payments">Open Payments</Link></div>}
    {table==='customer_payments'||table==='supplier_payments' ? <div className="console-panel"><div className="panel-heading"><h2>Payment actions</h2></div><Link className="secondary-button" href="/dashboard">Open reconciliation</Link></div>:null}
    {table==='v_inventory_current'||table==='inventory_transactions' ? <div className="console-panel"><div className="panel-heading"><h2>Inventory action</h2></div><Link className="primary-button" href="/inventory">Open Stock Action</Link></div>:null}
    {(table==='sales'||table==='invoices') && <div className="console-panel"><div className="panel-heading"><h2>Sales & Invoice actions</h2></div><Link className="primary-button" href="/payments">Open Payments</Link></div>}
    {message&&<p className={`form-status${error?' form-status-error':''}`} role="alert">{message}</p>}
  </section>
}
