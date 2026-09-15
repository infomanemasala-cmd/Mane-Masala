'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Row = Record<string, unknown>
const PAGE_SIZES = [20, 50, 100]
const HIDDEN_COLUMNS = new Set(['id', 'created_at', 'updated_at', 'category_id', 'base_unit_id', 'purchase_unit_id', 'selling_unit_id', 'customer_id'])
const SEARCH_COLUMNS: Record<string, string[]> = {
  items: ['item_code','business_code','name','item_type','subcategory','product_family','notes'],
  suppliers: ['business_code','business_name','contact_person','supplier_type','phone','whatsapp','upi_id','gst_number','email','notes'],
  customers: ['business_code','name','customer_type','phone','whatsapp','email','gst_number','notes'],
  units: ['code','name','symbol'], categories: ['code','name'], sub_agents: ['business_code','name','phone','whatsapp','notes'],
  purchases: ['business_code','supplier_invoice_number','system_reference','purchase_source','financial_status','workflow_status','notes'],
  v_purchases_list: ['business_code','supplier_code','supplier_name','supplier_invoice_number','purchase_source','financial_status','workflow_status'],
  inventory_transactions: ['business_code','transaction_type','reference_type','notes'],
  v_inventory_current: ['business_code','name'], recipes: ['business_code','name','status','notes'],
  production_batches: ['business_code','status','wife_approval_status','notes'],
  v_production_batches_list: ['business_code','output_item_code','output_item_name','status','wife_approval_status'],
  orders: ['business_code','source','status','order_party_type','requests','notes'],
  v_orders_list: ['business_code','billing_customer_code','billing_customer_name','sub_agent_code','sub_agent_name','end_customer','source','status','order_party_type'],
  dispatches: ['business_code','dispatch_date','dispatch_method','status','notes'],
  sales: ['business_code','status','notes'], invoices: ['business_code','invoice_number','financial_year','status','notes'],
  supplier_payments: ['business_code','payment_method','upi_reference','notes'], customer_payments: ['business_code','payment_method','upi_reference','notes'],
  v_supplier_outstanding: ['business_code','business_name'], v_customer_outstanding: ['business_code','name'],
}
const DEFAULT_SORT: Record<string,string> = { items:'item_code', units:'code', categories:'code', suppliers:'business_name', customers:'name', sub_agents:'name', v_inventory_current:'business_code', v_purchases_list:'purchase_date', v_orders_list:'order_date', v_production_batches_list:'production_date', dispatches:'dispatch_date', sales:'sale_date', invoices:'invoice_date', supplier_payments:'payment_date', customer_payments:'payment_date', v_supplier_outstanding:'business_name', v_customer_outstanding:'name' }
function label(column:string){if(column==='item_code')return 'Item Code';return column.replaceAll('_',' ').replace(/\b\w/g,l=>l.toUpperCase())}
function displayValue(value:unknown){if(value===null||value===undefined)return '';if(typeof value==='boolean')return value?'Yes':'No';return String(value)}
function safeSearch(value:string){return value.replace(/[%,()]/g,' ').trim()}
async function enrichItemRows(rows:Row[]){if(!rows.length)return rows;const client=createClient();const categoryIds=[...new Set(rows.map(r=>String(r.category_id||'')).filter(Boolean))];const unitIds=[...new Set(rows.flatMap(r=>['base_unit_id','purchase_unit_id','selling_unit_id'].map(k=>String(r[k]||'')).filter(Boolean)))];const [{data:categories},{data:units}]=await Promise.all([categoryIds.length?client.from('categories').select('id,code,name').in('id',categoryIds):Promise.resolve({data:[] as Row[]}),unitIds.length?client.from('units').select('id,code,name,symbol').in('id',unitIds):Promise.resolve({data:[] as Row[]})]);const cm=new Map((categories??[]).map(r=>[String(r.id),r]));const um=new Map((units??[]).map(r=>[String(r.id),r]));return rows.map(r=>{const c=cm.get(String(r.category_id||'')),b=um.get(String(r.base_unit_id||'')),p=um.get(String(r.purchase_unit_id||'')),s=um.get(String(r.selling_unit_id||''));return {...r,category:c?`${String(c.code)} — ${String(c.name)}`:'',base_unit:b?`${String(b.name)} (${String(b.symbol)})`:'',purchase_unit:p?`${String(p.name)} (${String(p.symbol)})`:'',selling_unit:s?`${String(s.name)} (${String(s.symbol)})`:''}})}

export default function DataTable({table,refreshToken=0}:{table:string;refreshToken?:number}){
 const[rows,setRows]=useState<Row[]>([]),[total,setTotal]=useState(0),[page,setPage]=useState(1),[pageSize,setPageSize]=useState(20),[search,setSearch]=useState(''),[sort,setSort]=useState(DEFAULT_SORT[table]??'created_at'),[ascending,setAscending]=useState(Boolean(DEFAULT_SORT[table])),[error,setError]=useState(''),[loading,setLoading]=useState(true)
 useEffect(()=>{setPage(1);setSort(DEFAULT_SORT[table]??'created_at');setAscending(Boolean(DEFAULT_SORT[table]));setSearch('')},[table])
 useEffect(()=>{let cancelled=false;const load=async()=>{setLoading(true);setError('');let q=createClient().from(table).select('*',{count:'exact'}).order(sort,{ascending,nullsFirst:false}).range((page-1)*pageSize,page*pageSize-1);const term=safeSearch(search),fields=SEARCH_COLUMNS[table]??[];if(term&&fields.length)q=q.or(fields.map(f=>`${f}.ilike.%${term}%`).join(','));const{data,count,error:e}=await q;if(cancelled)return;if(e){setError(e.message);setLoading(false);return}const enriched=table==='items'?await enrichItemRows((data??[])as Row[]):(data??[])as Row[];if(cancelled)return;setRows(enriched);setTotal(count??0);setLoading(false)};void load();return()=>{cancelled=true}},[table,page,pageSize,search,sort,ascending,refreshToken])
 const columns=useMemo(()=>{const first=rows[0];if(!first)return[];return Object.keys(first).filter(c=>!HIDDEN_COLUMNS.has(c)&&!c.endsWith('_id')&&!['created_by','approved_by','confirmed_by'].includes(c))},[rows]);const totalPages=Math.max(1,Math.ceil(total/pageSize)),start=total?(page-1)*pageSize+1:0,end=Math.min(page*pageSize,total)
 const chooseSort=(column:string)=>{if(sort===column)setAscending(v=>!v);else{setSort(column);setAscending(true)}setPage(1)};const changeSearch=(v:string)=>{setSearch(v);setPage(1)}
 if(error)return <p className="form-status form-status-error">{error}</p>
 return <div className="data-table"><div className="table-toolbar"><input className="table-search" value={search} onChange={e=>changeSearch(e.target.value)} placeholder="Search…" aria-label={`Search ${table}`}/><div className="table-toolbar-right"><span className="table-count">{total} record{total===1?'':'s'}</span><select value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setPage(1)}} aria-label="Rows per page">{PAGE_SIZES.map(size=><option key={size} value={size}>{size} per page</option>)}</select></div></div><div className="table-wrap"><table><thead><tr>{columns.map(column=><th key={column}><button className="table-sort" type="button" onClick={()=>chooseSort(column)}>{label(column)} {sort===column?(ascending?'↑':'↓'):'↕'}</button></th>)}</tr></thead><tbody>{loading?<tr><td colSpan={Math.max(columns.length,1)} className="table-message">Loading…</td></tr>:!rows.length?<tr><td colSpan={Math.max(columns.length,1)} className="table-message">No records found.</td></tr>:rows.map((row,index)=><tr key={String(row.id??`${page}-${index}`)}>{columns.map(column=><td key={column}>{displayValue(row[column])}</td>)}</tr>)}</tbody></table></div><div className="table-pagination"><span>Showing {start}–{end} of {total}</span><div><button type="button" onClick={()=>setPage(v=>Math.max(1,v-1))} disabled={page<=1}>Previous</button><span>Page {page} of {totalPages}</span><button type="button" onClick={()=>setPage(v=>Math.min(totalPages,v+1))} disabled={page>=totalPages}>Next</button></div></div></div>
}
