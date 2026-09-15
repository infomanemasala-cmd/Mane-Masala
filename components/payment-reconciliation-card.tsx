'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Row = Record<string, any>
const db = () => createClient()
const txt = (v: any) => String(v ?? '')

export default function PaymentReconciliationCard() {
  const [rows,setRows]=useState<Row[]>([]),[open,setOpen]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(false),[busy,setBusy]=useState(false)
  const load=async()=>{
    const [cp,ca,cadv,sp,sa,sadv,refs,inv,pur]=await Promise.all([
      db().from('customer_payments').select('id,business_code,customer_id,payment_date,amount,payment_method').order('payment_date',{ascending:false}),
      db().from('customer_payment_allocations').select('payment_id,invoice_id,amount'),
      db().from('customer_advances').select('payment_id,order_id,amount,status'),
      db().from('supplier_payments').select('id,business_code,supplier_id,payment_date,amount,payment_method').order('payment_date',{ascending:false}),
      db().from('supplier_payment_allocations').select('payment_id,purchase_id,amount'),
      db().from('supplier_advances').select('payment_id,amount,status'),
      db().from('payment_references').select('payment_side,payment_id,reference_type,reference_number'),
      db().from('invoices').select('id,invoice_number,business_code,billing_customer_id,amount_due,status').neq('status','cancelled'),
      db().from('purchases').select('id,business_code,supplier_invoice_number,supplier_id,financial_status').neq('workflow_status','cancelled')
    ])
    const caMap=new Map<string,number>();(ca.data??[]).forEach(x=>caMap.set(txt(x.payment_id),(caMap.get(txt(x.payment_id))??0)+Number(x.amount||0)))
    const saMap=new Map<string,number>();(sa.data??[]).forEach(x=>saMap.set(txt(x.payment_id),(saMap.get(txt(x.payment_id))??0)+Number(x.amount||0)))
    const advCustomer=new Set((cadv.data??[]).filter(x=>['open','partially_applied'].includes(txt(x.status))).map(x=>txt(x.payment_id)))
    const advSupplier=new Set((sadv.data??[]).filter(x=>['open','partially_applied'].includes(txt(x.status))).map(x=>txt(x.payment_id)))
    const refSet=new Set((refs.data??[]).map(x=>`${x.payment_side}:${txt(x.payment_id)}`))
    const customers=new Map((cp.data??[]).map(x=>[txt(x.id),x])); const suppliers=new Map((sp.data??[]).map(x=>[txt(x.id),x]))
    const result:Row[]=[]
    ;(cp.data??[]).forEach(p=>{const remaining=Number(p.amount)-Number(caMap.get(txt(p.id))??0);if(remaining>0&&!advCustomer.has(txt(p.id))&&!refSet.has(`customer:${txt(p.id)}`))result.push({side:'customer',...p,remaining,documents:(inv.data??[]).filter(i=>txt(i.billing_customer_id)===txt(p.customer_id))})})
    ;(sp.data??[]).forEach(p=>{const remaining=Number(p.amount)-Number(saMap.get(txt(p.id))??0);if(remaining>0&&!advSupplier.has(txt(p.id))&&!refSet.has(`supplier:${txt(p.id)}`))result.push({side:'supplier',...p,remaining,documents:(pur.data??[]).filter(i=>txt(i.supplier_id)===txt(p.supplier_id))})})
    setRows(result)
  }
  useEffect(()=>{void load()},[])
  const count=rows.length
  const resolve=async(row:Row,type:string,referenceId?:string)=>{setBusy(true);setMessage('');setError(false);const{data,error:e}=await db().rpc('resolve_unreferenced_payment',{p_payment_side:row.side,p_payment_id:row.id,p_reference_type:type,p_reference_id:referenceId||null});setBusy(false);if(e){setError(true);setMessage(e.message);return}setMessage(`${row.side==='customer'?'Customer':'Supplier'} payment ${txt(row.business_code)} resolved as ${txt(data?.reference_number)}.`);await load()}
  const summary=useMemo(()=>count===0?'All payments are associated or accounted for as advances.':`${count} payment${count===1?'':'s'} need reconciliation.`,[count])
  return <div className="console-panel"><div className="panel-heading"><h2>Payment reconciliation</h2><span className="status-pill">{count} unresolved</span></div><p className="page-intro">{summary} Use an invoice/purchase, a receipt reference, or a system-generated reference for an offline payment that was entered without a document link.</p><button className="primary-button" type="button" onClick={()=>setOpen(true)} disabled={count===0}>Review unreferenced payments</button>
    {open&&<div className="modal-backdrop"><div className="modal-card purchase-modal"><div className="modal-header"><h3>Unreferenced payments</h3><button className="secondary-button" type="button" onClick={()=>setOpen(false)}>Close</button></div>{rows.map(row=><div className="console-panel" key={`${row.side}:${txt(row.id)}`}><div className="panel-heading"><h2>{row.side==='customer'?'Customer payment':'Supplier payment'} — {txt(row.business_code)}</h2></div><div className="form-grid"><label className="field"><span>Date</span><input value={txt(row.payment_date)} readOnly/></label><label className="field"><span>Amount</span><input value={`₹ ${Number(row.remaining).toFixed(2)}`} readOnly/></label><label className="field"><span>Reference choice</span><select id={`ref-${row.id}`} defaultValue="auto"><option value="invoice">Invoice / Purchase</option><option value="receipt">Receipt reference</option><option value="auto">Auto-generated reference</option></select></label>{<label className="field"><span>Invoice / Purchase</span><select id={`doc-${row.id}`} defaultValue=""><option value="">Select document</option>{row.documents.map((d:Row)=><option key={txt(d.id)} value={txt(d.id)}>{txt(d.invoice_number||d.supplier_invoice_number||d.business_code)}{d.amount_due!=null?` — due ₹ ${Number(d.amount_due).toFixed(2)}`:''}</option>)}</select></label>}</div><div className="purchase-actions"><button className="primary-button" type="button" disabled={busy} onClick={()=>{const type=(document.getElementById(`ref-${row.id}`) as HTMLSelectElement).value;const ref=(document.getElementById(`doc-${row.id}`) as HTMLSelectElement).value;if(type==='invoice'&&!ref){setError(true);setMessage('Select an invoice/purchase before saving.');return}void resolve(row,type,ref)}}>Save reference</button></div></div>)}{message&&<p className={`form-status${error?' form-status-error':''}`}>{message}</p>}</div></div>}
  </div>
}
