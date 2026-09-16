'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

type UnitInfo = { unitId: string; symbol: string; label: string }

const GENERIC_PLACEHOLDERS = new Set([
  '0.000', '0.00', '0.000 kg', '0.000 g', '0 Nos', '0.000 litre', '0.000 ml',
  '0.000 — quantity in the unit shown', '0.00 Quantity', '0.00 quantity',
  'Enter the value', 'Enter a short note', 'Enter a short description',
  'Reference number', '₹ 0.00', '₹ 0.00 / kg', '₹ 0.00 / g',
])

function normaliseUnit(value: string) {
  const t = String(value || '').trim().toLowerCase()
  if (t === 'kg' || t === 'kilogram' || t === 'kilograms') return 'kg'
  if (t === 'g' || t === 'gram' || t === 'grams') return 'g'
  if (t === 'ml' || t === 'millilitre' || t === 'milliliter' || t === 'millilitres' || t === 'milliliters') return 'ml'
  if (t === 'l' || t === 'litre' || t === 'liter' || t === 'litres' || t === 'liters') return 'litre'
  if (t === 'nos' || t === 'no' || t === 'number' || /piece|pieces/.test(t)) return 'Nos'
  return String(value || '')
}

function unitFromText(text: string) {
  const t = text.toLowerCase()
  if (/\bkg\b|kilogram/.test(t)) return 'kg'
  if (/\bml\b|millilitre|milliliter/.test(t)) return 'ml'
  if (/\blitre\b|\bliter\b|\blitres\b|\bliters\b/.test(t)) return 'litre'
  if (/\bnos\b|number of|pieces?/.test(t)) return 'Nos'
  if (/\bg\b|gram/.test(t)) return 'g'
  return ''
}

function quantityHint(unit: string) {
  const u = normaliseUnit(unit)
  if (u === 'kg') return '0.000 kg'
  if (u === 'g') return '0.000 g'
  if (u === 'ml') return '0.000 ml'
  if (u === 'litre') return '0.000 litre'
  if (u === 'Nos') return '0 Nos'
  return '0.000 — select the item to show its unit'
}

function rateHint(unit: string) {
  const u = normaliseUnit(unit)
  if (u === 'kg') return '₹ 0.00 / kg'
  if (u === 'g') return '₹ 0.00 / g'
  if (u === 'ml') return '₹ 0.00 / ml'
  if (u === 'litre') return '₹ 0.00 / litre'
  if (u === 'Nos') return '₹ 0.00 / Nos'
  return '₹ 0.00'
}

function isGenericPlaceholder(value: string) {
  const v = value.trim()
  return !v || GENERIC_PLACEHOLDERS.has(v) || /^enter\s/i.test(v) || /^0(?:\.0+)?\s*(quantity|qty)$/i.test(v)
}

export default function FormGuidance() {
  const cache = useRef<Map<string, UnitInfo>>(new Map())

  useEffect(() => {
    let cancelled = false
    const sb = createClient()
    const selectSearch = new WeakMap<HTMLSelectElement, { buffer: string; at: number }>()

    const selectedItemUnit = (select: HTMLSelectElement) => {
      const id = select.value
      if (!id) return ''
      return cache.current.get(id)?.symbol || ''
    }

    const itemSelectsIn = (field: HTMLElement) => {
      const scope = field.closest('.console-panel, .modal-card, form') || field.parentElement || field
      return [...scope.querySelectorAll<HTMLSelectElement>('select')].filter(select => cache.current.has(select.value))
    }

    const applyField = (field: HTMLElement) => {
      const span = field.querySelector('span')
      const originalLabel = (span?.textContent || field.textContent || '').trim()
      const labelForLogic = originalLabel.replace(/\s*\((?:kg|g|ml|litre|Nos)\)\s*$/i, '').trim()
      const lower = labelForLogic.toLowerCase()
      const input = field.querySelector<HTMLInputElement>('input:not([type="hidden"]):not([readonly]), textarea')
      if (!input) return

      const row = field.closest('tr')
      let unit = unitFromText(`${labelForLogic} ${row?.textContent || ''}`)

      if (!unit && /quantity|qty|output|consumption|actual|planned/i.test(lower)) {
        const rowSelect = row?.querySelector<HTMLSelectElement>('select')
        unit = rowSelect ? selectedItemUnit(rowSelect) : ''
      }

      if (/additional\s+quantity/i.test(lower)) {
        const candidate = itemSelectsIn(field)[0]
        unit = unit || (candidate ? selectedItemUnit(candidate) : '')
        if (unit && span) {
          const nextLabel = `Additional quantity (${normaliseUnit(unit)})`
          // MutationObserver watches childList changes. Do not rewrite identical
          // label text or the observer will continuously trigger itself.
          if (span.textContent !== nextLabel) span.textContent = nextLabel
        }
      }

      let hint = ''
      if (lower.includes('date')) hint = 'DD-MM-YYYY'
      else if (lower.includes('phone') || lower.includes('mobile')) hint = '10-digit mobile number'
      else if (lower.includes('email')) hint = 'name@example.com'
      else if (lower.includes('invoice')) hint = "Supplier's invoice number"
      else if (lower.includes('reference') || lower === 'ref') hint = 'System generated if blank'
      else if (lower.includes('rate')) hint = rateHint(unit)
      else if (lower.includes('percent') || lower.includes('%') || lower.includes('tax')) hint = '0.00 %'
      else if (lower.includes('amount') || lower.includes('price') || lower.includes('charge') || lower.includes('discount') || lower.includes('advance')) hint = '₹ 0.00'
      else if (lower.includes('quantity') || lower.includes('qty') || lower.includes('output') || lower.includes('consumption') || lower.includes('actual') || lower.includes('planned')) hint = quantityHint(unit)
      else if (lower.includes('code')) hint = 'Business / item code'
      else if (lower.includes('address')) hint = 'House / street / area...'
      else if (lower.includes('note') || lower.includes('remark') || lower.includes('reason')) hint = 'Enter a short note...'
      else if (lower.includes('description')) hint = 'Enter a short description...'
      else if (lower.includes('name')) hint = 'Enter name'
      else if (input.type === 'number') hint = '0.00'

      if (hint && (isGenericPlaceholder(input.placeholder || '') || /quantity|qty|rate|output|consumption|actual|planned/i.test(lower))) {
        input.placeholder = hint
      }

      if (unit && /quantity|qty|output|consumption|actual|planned/i.test(lower)) {
        const u = normaliseUnit(unit)
        input.setAttribute('data-unit', u)
        input.setAttribute('aria-label', `${labelForLogic} — enter quantity in ${u}`)
        input.setAttribute('title', `Enter ${labelForLogic.toLowerCase()} in ${u}`)
        if (input.type === 'number') input.step = u === 'Nos' ? '1' : '0.001'
      }
    }

    const applyTableRow = (row: HTMLTableRowElement, headers: string[]) => {
      const cells = [...row.cells]
      cells.forEach((cell, i) => {
        const input = cell.querySelector<HTMLInputElement>('input[type="number"]')
        if (!input) return
        const head = (headers[i] || cell.textContent || '').trim().toLowerCase()
        if (!/quantity|qty|rate|amount|price|output|consumption|actual|planned/i.test(head)) return
        const select = row.querySelector<HTMLSelectElement>('select')
        const unit = select ? selectedItemUnit(select) : unitFromText(`${head} ${cell.textContent || ''}`)
        if (/rate/.test(head)) input.placeholder = rateHint(unit)
        else input.placeholder = quantityHint(unit)
        if (unit) {
          const u = normaliseUnit(unit)
          input.setAttribute('data-unit', u)
          input.setAttribute('aria-label', `${head} — enter in ${u}`)
          input.setAttribute('title', `Enter ${head} in ${u}`)
          input.step = u === 'Nos' ? '1' : '0.001'
        }
      })
    }

    const apply = () => {
      document.querySelectorAll<HTMLElement>('.field, .form-field, .form-stack label').forEach(applyField)
      document.querySelectorAll<HTMLTableElement>('table').forEach(table => {
        const headers = [...table.querySelectorAll('thead th')].map(x => x.textContent || '')
        table.querySelectorAll<HTMLTableRowElement>('tbody tr').forEach(row => applyTableRow(row, headers))
      })
    }

    const refreshFromSelection = (event: Event) => {
      if (!(event.target instanceof HTMLSelectElement)) return
      apply()
    }

    const searchDropdownByCodeOrName = (event: KeyboardEvent) => {
      const select = event.target instanceof HTMLSelectElement ? event.target : null
      if (!select || select.disabled) return
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape', 'Tab', 'Home', 'End', 'PageUp', 'PageDown', ' ', 'Backspace', 'Delete'].includes(event.key)) return
      if (event.key.length !== 1) return

      const now = Date.now()
      const state = selectSearch.get(select) || { buffer: '', at: 0 }
      const buffer = now - state.at > 750 ? event.key : state.buffer + event.key
      const query = buffer.trim().toLowerCase()
      if (!query) return

      const options = [...select.options].filter(option => !option.disabled && option.value)
      const match = options.find(option => option.textContent?.toLowerCase().includes(query))
      if (!match) {
        selectSearch.set(select, { buffer: event.key, at: now })
        return
      }

      selectSearch.set(select, { buffer, at: now })
      event.preventDefault()
      event.stopPropagation()
      if (select.value !== match.value) {
        select.value = match.value
        select.dispatchEvent(new Event('change', { bubbles: true }))
      }
    }

    const loadUnits = async () => {
      const [{ data: items }, { data: units }] = await Promise.all([
        sb.from('items').select('id,base_unit_id').eq('is_active', true),
        sb.from('units').select('id,symbol,name').eq('is_active', true),
      ])
      if (cancelled) return
      const um = new Map((units || []).map((u: any) => {
        const raw = String(u.symbol || u.name || '')
        return [String(u.id), { symbol: normaliseUnit(raw), label: String(u.name || raw) }]
      }))
      for (const item of items || []) {
        const id = String(item.id)
        const base = String(item.base_unit_id || '')
        const info = um.get(base)
        cache.current.set(id, { unitId: base, symbol: info?.symbol || '', label: info?.label || '' })
      }
      apply()
    }

    apply()
    void loadUnits()
    document.addEventListener('change', refreshFromSelection, true)
    document.addEventListener('keydown', searchDropdownByCodeOrName, true)
    const observer = new MutationObserver(apply)
    observer.observe(document.body, { subtree: true, childList: true })

    return () => {
      cancelled = true
      observer.disconnect()
      document.removeEventListener('change', refreshFromSelection, true)
      document.removeEventListener('keydown', searchDropdownByCodeOrName, true)
    }
  }, [])

  return null
}
