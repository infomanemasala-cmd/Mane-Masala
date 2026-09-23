'use client'

import { useMemo, useState } from 'react'

export type SearchOption = { value: string; label: string; search?: string }

export default function SearchableSelect({ value, onChange, options, placeholder='Select', disabled=false, name }: { value:string; onChange:(value:string)=>void; options:SearchOption[]; placeholder?:string; disabled?:boolean; name?:string }) {
  const [open,setOpen]=useState(false)
  const [query,setQuery]=useState('')
  const selected=options.find(o=>o.value===value)
  const filtered=useMemo(()=>{ const q=query.trim().toLowerCase(); if(!q) return options.slice(0,80); return options.filter(o=>(o.label+' '+(o.search??'')).toLowerCase().includes(q)).slice(0,80) },[options,query])
  return <div className="searchable-select">
    {name&&<input type="hidden" name={name} value={value}/>} 
    <input className="searchable-select-input" value={open?query:(selected?.label??'')} placeholder={placeholder} disabled={disabled} onFocus={()=>{setOpen(true);setQuery('')}} onChange={e=>{setQuery(e.target.value);setOpen(true)}} onKeyDown={e=>{if(e.key==='Escape'){setOpen(false);setQuery('');return} if(e.key==='Enter'&&filtered[0]){e.preventDefault();onChange(filtered[0].value);setOpen(false);setQuery('')}}} aria-expanded={open} aria-autocomplete="list"/>
    {open&&<div className="searchable-select-menu" role="listbox">{filtered.length===0?<div className="searchable-select-empty">No matches.</div>:filtered.map(o=><button type="button" className={'searchable-select-option'+(o.value===value?' selected':'')} key={o.value} onMouseDown={e=>e.preventDefault()} onClick={()=>{onChange(o.value);setOpen(false);setQuery('')}}>{o.label}</button>)}</div>}
  </div>
}