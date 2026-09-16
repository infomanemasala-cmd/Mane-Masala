'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

const GENERIC_PLACEHOLDERS = new Set([
  '0.000','0.00','0.000 kg','0.000 g','0 Nos','0.000 — quantity in the unit shown',
  '0.00 Quantity','0.00 quantity','Enter the value','Enter a short note','Enter a short description',
  'Reference number','₹ 0.00'
])

function unitFromText(text:string){
  const t=text.toLowerCase()
  if (/\bkg\b|kilogram/.test(t)) return 'kg'
  if (/\bg\b|gram/.test(t)) return 'g'
  if (/\bnos\b|number of|pieces?/.test(t)) return 'Nos'
  return ''
}

function quantityHint(unit:string){
  if(unit==='kg') return '0.000 kg'
  if(unit==='g') return '0.000 g'
  if(unit==='Nos') return '0 Nos'
  return '0.000 — quantity in the unit shown'
}

function isGenericPlaceholder(value:string){
  const v=value.trim()
  return !v || GENERIC_PLACEHOLDERS.has(v) || /^enter\s/i.test(v) || /^0(?:\.0+)?\s*(quantity|qty)$/i.test(v)
}

export default function FormGuidance(){
  const cache=useRef<Map<string,{unitId:string;symbol:string}>>(new Map())
  useEffect(()=>{
    let cancelled=false
    const sb=createClient()
    const loadUnits=async()=>{
      const [{data:items},{data:units}]=await Promise.all([
        sb.from('items').select('id,base_unit_id').eq('is_active',true),
        sb.from('units').select('id,symbol,name').eq('is_active',true)
      ])
      if(cancelled) return
      const um=new Map((units??[]).map((u:any)=>[String(u.id),String(u.symbol||u.name||'')]))
      for(const item of items??[]) cache.current.set(String(item.id),{unitId:String(item.base_unit_id||''),symbol:um.get(String(item.base_unit_id||''))||''})
      apply()
    }

    const selectedItemUnit=(select:HTMLSelectElement)=>{
      const id=select.value
      if(!id) return ''
      return cache.current.get(id)?.symbol||''
    }

    const applyField=(field:HTMLElement)=>{
      const label=(field.querySelector('span')?.textContent||field.textContent||'').trim()
      const input=field.querySelector<HTMLInputElement>('input:not([type="hidden"]):not([readonly]), textarea')
      if(!input) return
      let context=label
      const row=field.closest('tr')
      if(row) context=`${row.textContent||''} ${context}`
      let unit=unitFromText(context)
      if(!unit && /quantity|qty|output|consumption/i.test(label)){
        const select=row?.querySelector<HTMLSelectElement>('select')
        unit=select?selectedItemUnit(select):''
      }
      if(/additional\s+quantity/i.test(label)){
        const selects=[...field.closest('.console-panel,.modal-card,form')?.querySelectorAll<HTMLSelectElement>('select')||[]]
        const candidate=selects.find(x=>x.value && cache.current.has(x.value))
        unit=unit|| (candidate?selectedItemUnit(candidate):'')
        if(unit){
          const span=field.querySelector('span')
          if(span && !/\(kg\)|\(g\)|\(Nos\)/i.test(span.textContent||'')) span.textContent=`Additional quantity (${unit})`
        }
      }
      const existing=input.placeholder||''
      const lower=label.toLowerCase()
      let hint=''
      if(lower.includes('date')) hint='DD-MM-YYYY'
      else if(lower.includes('phone')||lower.includes('mobile')) hint='10-digit mobile number'
      else if(lower.includes('email')) hint='name@example.com'
      else if(lower.includes('invoice')) hint="Supplier's invoice number"
      else if(lower.includes('reference')||lower.includes('ref')) hint='System generated if blank'
      else if(lower.includes('rate')&&unit==='kg') hint='₹ 0.00 / kg'
      else if(lower.includes('rate')&&unit==='g') hint='₹ 0.00 / g'
      else if(lower.includes('rate')) hint='₹ 0.00'
      else if(lower.includes('percent')||lower.includes('%')||lower.includes('tax')) hint='0.00 %'
      else if(lower.includes('amount')||lower.includes('price')||lower.includes('charge')||lower.includes('discount')||lower.includes('advance')) hint='₹ 0.00'
      else if(lower.includes('quantity')||lower.includes('qty')||lower.includes('output')||lower.includes('consumption')) hint=quantityHint(unit)
      else if(lower.includes('code')) hint='Business / item code'
      else if(lower.includes('address')) hint='House / street / area...'
      else if(lower.includes('note')||lower.includes('remark')||lower.includes('reason')) hint='Enter a short note...'
      else if(lower.includes('description')) hint='Enter a short description...'
      else if(lower.includes('name')) hint='Enter name'
      else if(input.type==='number') hint='0.00'
      if(hint && (isGenericPlaceholder(existing)||/quantity/i.test(lower))) input.placeholder=hint
      if(unit && (lower.includes('quantity')||lower.includes('qty')||lower.includes('output')||lower.includes('consumption'))){
        input.setAttribute('data-unit',unit)
        input.setAttribute('aria-label',`${label} — enter quantity in ${unit}`)
        if(input.type==='number' && unit==='Nos') input.step='1'
        else if(input.type==='number') input.step='0.001'
      }
    }

    const applyTableRow=(row:HTMLTableRowElement,headers:string[])=>{
      const cells=[...row.cells]
      cells.forEach((cell,i)=>{
        const input=cell.querySelector<HTMLInputElement>('input[type="number"]')
        if(!input) return
        const head=(headers[i]||cell.textContent||'').trim().toLowerCase()
        if(!/quantity|qty|rate|amount|price|output|consumption|actual|planned/i.test(head)) return
        const select=row.querySelector<HTMLSelectElement>('select')
        const unit=select?selectedItemUnit(select):unitFromText(`${head} ${cell.textContent||''}`)
        if(/rate/.test(head)) input.placeholder=unit==='kg'?'₹ 0.00 / kg':unit==='g'?'₹ 0.00 / g':'₹ 0.00'
        else if(/quantity|qty|output|consumption|actual|planned/.test(head)) input.placeholder=quantityHint(unit)
        if(unit){input.setAttribute('data-unit',unit);input.setAttribute('aria-label',`${head} — ${unit}`);if(unit==='Nos') input.step='1';else input.step='0.001'}
      })
    }

    const apply=()=>{
      document.querySelectorAll<HTMLElement>('.field, .form-field, .form-stack label').forEach(applyField)
      document.querySelectorAll<HTMLTableElement>('table').forEach(table=>{
        const headers=[...table.querySelectorAll('thead th')].map(x=>x.textContent||'')
        table.querySelectorAll<HTMLTableRowElement>('tbody tr').forEach(row=>applyTableRow(row,headers))
      })
    }
    apply()
    void loadUnits()
    const observer=new MutationObserver(apply)
    observer.observe(document.body,{subtree:true,childList:true})
    return()=>{cancelled=true;observer.disconnect()}
  },[])
  return null
}
