'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Row = Record<string, any>
const db = () => createClient()
const txt = (v:any) => String(v ?? '')
const label = (k:string) => k.replaceAll('_',' ').replace(/\b\w/g, l => l.toUpperCase())
const num = (v:any) => Number(v || 0)
const money = (v:any) => `₹ ${num(v).toFixed(2)}`

// Internal UUID / system keys — not shown as primary labels in production UI
const HIDDEN_DETAIL_KEYS = new Set([
  'id','created_at','updated_at','created_by','approved_by','confirmed_by',
  'order_id','order_line_id','output_item_id','output_unit_id','recipe_version_id',
  'ingredient_item_id','unit_id','customer_id','supplier_id',
])

export default function TransactionDetail({ table, id }: { table:string; id:string }) {
  const [row,setRow] = useState<Row|null>(null)
  const [plan,setPlan] = useState<Row[]>([])
  const [itemNames,setItemNames] = useState<Record<string,Row>>({})
  const [unitNames,setUnitNames] = useState<Record<string,Row>>({})
  const [purchaseLines,setPurchaseLines] = useState<Row[]>([])
  const [purchaseItems,setPurchaseItems] = useState<Record<string,Row>>({})
  const [receipt,setReceipt] = useState<Row|null>(null)
  const [receiptLines,setReceiptLines] = useState<Row[]>([])
  const [attachments,setAttachments] = useState<Row[]>([])
  const [message,setMessage] = useState(''), [error,setError] = useState(false), [busy,setBusy] = useState(false)
  const [actualOutput,setActualOutput] = useState('')
  const [actuals,setActuals] = useState<Record<string,string>>({})

  const load = async () => {
    const key = table === 'v_inventory_current' ? 'item_id' : 'id'
    const source = table === 'v_purchases_list' ? 'purchases' : table === 'v_production_batches_list' ? 'production_batches' : table
    const {data,error:e} = await db().from(source).select('*').eq(key,id).single()
    if(e){setError(true);setMessage(e.message);return}
    setRow(data)

    if(table==='production_batches' || table==='v_production_batches_list'){
      setActualOutput(txt(data?.planned_output_quantity))
      const {data:p} = await db().from('production_batch_plan_lines').select('id,ingredient_item_id,planned_quantity,unit_id').eq('production_batch_id',id).order('id')
      const lines = p??[]
      setPlan(lines)
      setActuals(Object.fromEntries(lines.map(x=>[txt(x.id),txt(x.planned_quantity)])))

      const ingredientIds = [...new Set(lines.map(x=>txt(x.ingredient_item_id)).filter(Boolean))]
      const unitIds = [...new Set(lines.map(x=>txt(x.unit_id)).filter(Boolean))]
      if (data?.output_item_id) ingredientIds.push(txt(data.output_item_id))
      if (data?.output_unit_id) unitIds.push(txt(data.output_unit_id))

      if (ingredientIds.length) {
        const { data: its } = await db().from('items').select('id,item_code,business_code,name').in('id', ingredientIds)
        setItemNames(Object.fromEntries((its??[]).map(x=>[txt(x.id),x])))
      } else setItemNames({})

      if (unitIds.length) {
        const { data: uns } = await db().from('units').select('id,name,symbol').in('id', unitIds)
        setUnitNames(Object.fromEntries((uns??[]).map(x=>[txt(x.id),x])))
      } else setUnitNames({})
    }

    if(table==='purchases' || table==='v_purchases_list'){
      const purchaseId = txt(data?.id || id)
      const {data:pl} = await db().from('purchase_lines').select('id,item_id,billed_quantity,unit_id,unit_rate,line_total,notes').eq('purchase_id',purchaseId).order('id')
      const lines = pl ?? []
      setPurchaseLines(lines)
      const itemIds = [...new Set(lines.map(x=>txt(x.item_id)).filter(Boolean))]
      if(itemIds.length){
        const {data:its} = await db().from('items').select('id,item_code,business_code,name').in('id',itemIds)
        setPurchaseItems(Object.fromEntries((its??[]).map(x=>[txt(x.id),x])))
      } else setPurchaseItems({})

      const {data:rc} = await db().from('purchase_receipts').select('id,status,received_at,received_by').eq('purchase_id',purchaseId).order('received_at',{ascending:false}).limit(1)
      const latestReceipt = rc?.[0] ?? null
      setReceipt(latestReceipt)
      if(latestReceipt){
        const {data:rl} = await db().from('purchase_receipt_lines').select('id,purchase_line_id,received_quantity,accepted_quantity,rejected_quantity,replacement_quantity,received_batch_date,expiry_date,best_before_date,notes').eq('receipt_id',latestReceipt.id).order('id')
        setReceiptLines(rl??[])
      } else setReceiptLines([])

      const {data:att} = await db().from('purchase_attachments').select('id,file_name,mime_type,file_size,uploaded_at,storage_path').eq('purchase_id',purchaseId).order('uploaded_at',{ascending:false})
      setAttachments(att??[])
    }
  }

  useEffect(()=>{void load()},[table,id])

  const action = async (rpc:string,args:Row) => {
    setBusy(true);setError(false);setMessage('')
    const {error:e}=await db().rpc(rpc,args)
    setBusy(false)
    if(e){setError(true);setMessage(e.message);return}
    setMessage('Action completed successfully.')
    await load()
  }

  const productionAction = useMemo(()=>{
    if(!row || !(table==='production_batches' || table==='v_production_batches_list')) return null
    if(txt(row.wife_approval_status)!=='approved') return {label:'Wife approve production plan',rpc:'approve_production_batch',args:{p_production_batch_id:id}}
    if(txt(row.status)==='planned') return {label:'Start production',rpc:'start_production_batch',args:{p_production_batch_id:id}}
    if(txt(row.status)==='in_progress') return {label:'Complete production',rpc:'complete_production',args:{p_production_batch_id:id,p_consumptions:plan.filter(p=>Number(actuals[txt(p.id)]||0)>0).map(p=>({ingredient_item_id:p.ingredient_item_id,actual_quantity:Number(actuals[txt(p.id)]),unit_id:p.unit_id})),p_outputs:[{output_item_id:row.output_item_id,quantity:Number(actualOutput),unit_id:row.output_unit_id}]}}
    return null
  },[row,id,table,plan,actuals,actualOutput])

  if(!row) return <section className="page-panel"><p>{message||'Loading transaction…'}</p></section>

  const isProduction = table==='production_batches' || table==='v_production_batches_list'
  const isPurchase = table==='purchases' || table==='v_purchases_list'
  const purchaseComplete = txt(row.workflow_status)==='completed'
  const purchaseNeedsCompletion = txt(row.workflow_status)==='inspected_stock'

  // Human-friendly detail fields for production (hide UUIDs)
  const fields = Object.entries(row).filter(([k])=>!HIDDEN_DETAIL_KEYS.has(k))
  const outputItem = itemNames[txt(row.output_item_id)]
  const outputUnit = unitNames[txt(row.output_unit_id)]

  return <section className="page-panel">
    <div className="master-header">
      <div><div className="section-label">Mane Masala</div><h1>{txt(row.business_code) || 'Transaction'}</h1><p className="page-intro">Review the complete transaction, then take the next business action.</p></div>
      <Link className="secondary-button" href={table.startsWith('v_order')||table==='orders'?'/orders':isPurchase?'/purchases':table.includes('production')?'/production':table.includes('payment')?'/payments':table.includes('invoice')||table==='sales'?'/sales-invoices':'/inventory'}>Back to list</Link>
    </div>

    <div className="console-panel">
      <div className="panel-heading"><h2>Transaction details</h2></div>
      <div className="form-grid">
        {isProduction && <>
          <div className="field"><span>Business Code</span><input value={txt(row.business_code)} readOnly /></div>
          <div className="field"><span>Production Date</span><input value={txt(row.production_date)} readOnly /></div>
          <div className="field"><span>Planned Output Quantity</span><input value={txt(row.planned_output_quantity)} readOnly /></div>
          <div className="field"><span>Actual Output Quantity</span><input value={txt(row.actual_output_quantity)} readOnly /></div>
          <div className="field"><span>Status</span><input value={txt(row.status)} readOnly /></div>
          <div className="field"><span>Wife Approval Status</span><input value={txt(row.wife_approval_status)} readOnly /></div>
          <div className="field"><span>Output Item</span><input value={outputItem ? `${txt(outputItem.item_code||outputItem.business_code)} — ${txt(outputItem.name)}` : txt(row.output_item_code||row.output_item_name)||'—'} readOnly /></div>
          <div className="field"><span>Output Unit</span><input value={outputUnit ? `${txt(outputUnit.name)} (${txt(outputUnit.symbol)})` : '—'} readOnly /></div>
          <div className="field"><span>Order Code</span><input value={txt(row.order_code)||'—'} readOnly /></div>
          <div className="field"><span>Recipe Version</span><input value={txt(row.recipe_version)||'—'} readOnly /></div>
        </>}
        {!isProduction && fields.map(([k,v])=><div className="field" key={k}><span>{label(k)}</span><input value={typeof v==='object'&&v!==null?JSON.stringify(v):txt(v)} readOnly /></div>)}
      </div>
    </div>

    {isPurchase && <>
      <div className="console-panel">
        <div className="panel-heading"><h2>Items purchased</h2><span>{purchaseLines.length} item{purchaseLines.length===1?'':'s'}</span></div>
        {purchaseLines.length===0 ? <p className="page-intro">No purchase lines were found for this transaction.</p> : <div className="table-wrap"><table className="data-table"><thead><tr><th>SL</th><th>Item</th><th>Qty billed</th><th>Rate / unit</th><th>Line total</th><th>Notes</th></tr></thead><tbody>{purchaseLines.map((l,i)=>{const it=purchaseItems[txt(l.item_id)]||{};return <tr key={txt(l.id)}><td>{i+1}</td><td><strong>{txt(it.item_code||it.business_code)}</strong>{txt(it.name)?` — ${txt(it.name)}`:''}</td><td>{txt(l.billed_quantity)}</td><td>{money(l.unit_rate)}</td><td>{money(l.line_total)}</td><td>{txt(l.notes)||'—'}</td></tr>})}</tbody></table></div>}
      </div>

      <div className="console-panel">
        <div className="panel-heading"><h2>Receipt & inspection</h2><span>{receipt ? label(txt(receipt.status)) : 'Not received yet'}</span></div>
        {!receipt ? <p className="page-intro">No physical receipt has been recorded yet. The purchase bill and the stock receipt are separate steps.</p> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Item</th><th>Received</th><th>Accepted into stock</th><th>Rejected</th><th>Replacement</th><th>Batch date</th></tr></thead><tbody>{receiptLines.map(rl=>{const pl=purchaseLines.find(x=>txt(x.id)===txt(rl.purchase_line_id))||{};const it=purchaseItems[txt(pl.item_id)]||{};return <tr key={txt(rl.id)}><td>{txt(it.item_code||it.business_code)} — {txt(it.name)}</td><td>{txt(rl.received_quantity)}</td><td>{txt(rl.accepted_quantity)}</td><td>{txt(rl.rejected_quantity)}</td><td>{txt(rl.replacement_quantity)}</td><td>{txt(rl.received_batch_date)||'—'}</td></tr>})}</tbody></table></div>}
      </div>

      <div className="console-panel">
        <div className="panel-heading"><h2>Bill / supporting documents</h2><span>{attachments.length} attached</span></div>
        {attachments.length===0 ? <p className="page-intro">No invoice or purchase slip is attached to this transaction.</p> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Document</th><th>Type</th><th>Size</th><th>Uploaded</th></tr></thead><tbody>{attachments.map(a=><tr key={txt(a.id)}><td>{txt(a.file_name)}</td><td>{txt(a.mime_type)||'—'}</td><td>{a.file_size ? `${Math.round(Number(a.file_size)/1024)} KB` : '—'}</td><td>{txt(a.uploaded_at)||'—'}</td></tr>)}</tbody></table></div>}
      </div>

      <div className="console-panel">
        <div className="panel-heading"><h2>Next action</h2></div>
        {purchaseComplete ? <p className="page-intro"><strong>Purchase completed.</strong> No further purchase action is required. Use Payments when the supplier payment is due.</p> : purchaseNeedsCompletion ? <><p className="page-intro">Receipt has been inspected and accepted stock is recorded. Complete the purchase only after the bill / inspection details have been checked.</p><button className="primary-button" type="button" disabled={busy} onClick={()=>void action('complete_purchase_inspection',{p_purchase_id:txt(row.id)})}>{busy?'Processing…':'Complete purchase'}</button></> : <p className="page-intro">Complete the physical receipt and inspection before completing this purchase.</p>}
        <Link className="secondary-button" href="/payments">Open Payments</Link>
      </div>
    </>}

    {productionAction && <div className="console-panel"><div className="panel-heading"><h2>Next action</h2></div>{isProduction&&<><div className="form-grid"><div className="field"><span>Actual output</span><input type="number" min="0" step="0.001" value={actualOutput} onChange={e=>setActualOutput(e.target.value)} /></div></div>
      <div className="table-wrap" style={{marginTop:12}}><table><thead><tr><th>Ingredient</th><th>Unit</th><th>Planned</th><th>Actual</th></tr></thead><tbody>
        {plan.map(p=>{
          const it=itemNames[txt(p.ingredient_item_id)]||{}
          const un=unitNames[txt(p.unit_id)]||{}
          return <tr key={txt(p.id)}>
            <td><strong>{txt(it.item_code||it.business_code)}</strong>{txt(it.name)?` — ${txt(it.name)}`:''}</td>
            <td>{txt(un.symbol||un.name)||'—'}</td>
            <td>{txt(p.planned_quantity)}</td>
            <td><input className="table-input" type="number" min="0" step="0.001" value={actuals[txt(p.id)]||''} onChange={e=>setActuals(x=>({...x,[txt(p.id)]:e.target.value}))} /></td>
          </tr>
        })}
      </tbody></table></div>
    </>}<button className="primary-button" type="button" disabled={busy} onClick={()=>void action(productionAction.rpc,productionAction.args)} style={{marginTop:12}}>{busy?'Processing…':productionAction.label}</button></div>}

    {(table==='customer_payments'||table==='supplier_payments') ? <div className="console-panel"><div className="panel-heading"><h2>Payment actions</h2></div><Link className="secondary-button" href="/dashboard">Open reconciliation</Link></div>:null}
    {table==='v_inventory_current'||table==='inventory_transactions' ? <div className="console-panel"><div className="panel-heading"><h2>Inventory action</h2></div><Link className="primary-button" href="/inventory">Open Stock Action</Link></div>:null}
    {(table==='sales'||table==='invoices') && <div className="console-panel"><div className="panel-heading"><h2>Sales & Invoice actions</h2></div><Link className="primary-button" href="/payments">Open Payments</Link></div>}
    {message&&<p className={`form-status${error?' form-status-error':''}`} role="alert">{message}</p>}
  </section>
}
