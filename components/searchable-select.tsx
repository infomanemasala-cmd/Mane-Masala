'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

export type SearchableOption = { value: string; label: string; code?: string; name?: string }

function norm(value: string) { return value.trim().toLocaleLowerCase() }

export default function SearchableSelect({ value, options, onChange, placeholder = 'Select…', disabled = false, ariaLabel, className = '', createOption }: { value: string; options: SearchableOption[]; onChange: (value: string) => void; placeholder?: string; disabled?: boolean; ariaLabel?: string; className?: string; createOption?: { label: string; value: string } }) {
  const [open, setOpen] = useState(false), [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const selected = options.find(option => option.value === value)
  const filtered = useMemo(() => { const term = norm(query); if (!term) return options; return options.filter(option => norm(`${option.code ?? ''} ${option.name ?? ''} ${option.label}`).includes(term)) }, [options, query])
  useEffect(() => { const close = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false) }; document.addEventListener('mousedown', close); return () => document.removeEventListener('mousedown', close) }, [])
  const choose = (next: string) => { onChange(next); setQuery(''); setOpen(false) }
  return <div ref={ref} className={`searchable-select ${className}`.trim()}>
    <button type="button" className="select-trigger" disabled={disabled} aria-haspopup="listbox" aria-expanded={open} aria-label={ariaLabel} onClick={() => { setOpen(v => !v); setQuery('') }}>{selected?.label ?? placeholder}<span aria-hidden="true">▾</span></button>
    {open && <div className="select-menu searchable-select-menu" role="listbox">
      <input autoFocus className="searchable-select-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search code or name…" aria-label="Search code or name" />
      <div className="searchable-select-results">{filtered.map(option => <button key={option.value} type="button" className={`select-option${option.value === value ? ' select-option-selected' : ''}`} role="option" aria-selected={option.value === value} onClick={() => choose(option.value)}>{option.label}</button>)}{!filtered.length && <div className="table-message">No matching records.</div>}</div>
      {createOption && <><div className="select-menu-divider" /><button type="button" className="select-create-action" onClick={() => choose(createOption.value)}>{createOption.label}</button></>}
    </div>}
  </div>
}
