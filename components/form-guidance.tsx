'use client'

import { useEffect } from 'react'

const GENERIC_PLACEHOLDERS = new Set([
  '0.000',
  '0.00',
  '0.000 — enter the unit shown',
  'Enter the value',
  'Enter a short note',
  'Enter a short description',
  'Reference number',
  '₹ 0.00',
])

function unitFromText(text: string) {
  const t = text.toLowerCase()
  if (/\bkg\b|kilogram/.test(t)) return 'kg'
  if (/\bg\b|gram/.test(t)) return 'g'
  if (/\bnos\b|number of|pieces?/.test(t)) return 'Nos'
  return ''
}

function hintFor(label: string, input: HTMLInputElement) {
  const l = label.toLowerCase()
  const unit = unitFromText(label)
  if (l.includes('date')) return 'DD-MM-YYYY'
  if (l.includes('phone') || l.includes('mobile')) return '10-digit mobile number'
  if (l.includes('email')) return 'name@example.com'
  if (l.includes('invoice')) return "Supplier's invoice number"
  if (l.includes('reference') || l.includes('ref')) return 'System generated if blank'
  if (l.includes('rate') && unit === 'kg') return '₹ 0.00 / kg'
  if (l.includes('rate') && unit === 'g') return '₹ 0.00 / g'
  if (l.includes('rate')) return '₹ 0.00'
  if (l.includes('percent') || l.includes('%')) return '0.00 %'
  if (l.includes('tax') && input.type === 'number') return '0.00 %'
  if (l.includes('amount') || l.includes('price') || l.includes('charge') || l.includes('discount') || l.includes('advance')) return '₹ 0.00'
  if (l.includes('quantity') || l.includes('qty') || l.includes('output') || l.includes('consumption')) {
    if (unit === 'kg') return '0.000 kg'
    if (unit === 'g') return '0.000 g'
    if (unit === 'Nos') return '0 Nos'
    return '0.000 — quantity in the unit shown'
  }
  if (l.includes('code')) return 'Business / item code'
  if (l.includes('address')) return 'House / street / area...'
  if (l.includes('note') || l.includes('remark') || l.includes('reason')) return 'Enter a short note...'
  if (l.includes('description')) return 'Enter a short description...'
  if (l.includes('name')) return 'Enter name'
  if (input.type === 'number') return '0.00'
  return ''
}

function isGenericPlaceholder(value: string) {
  const v = value.trim()
  return !v || GENERIC_PLACEHOLDERS.has(v) || /^enter\s/i.test(v)
}

export default function FormGuidance() {
  useEffect(() => {
    const apply = () => {
      document.querySelectorAll<HTMLElement>('.field, .form-field, .form-stack label').forEach(field => {
        const label = field.querySelector('span')?.textContent || field.textContent || ''
        const input = field.querySelector<HTMLInputElement>('input:not([type="hidden"]):not([readonly]), textarea')
        if (!input) return
        const existing = input.placeholder || ''
        if (!isGenericPlaceholder(existing)) return
        const hint = hintFor(label, input)
        if (hint) input.placeholder = hint
      })
    }
    apply()
    const observer = new MutationObserver(apply)
    observer.observe(document.body, { subtree: true, childList: true })
    return () => observer.disconnect()
  }, [])
  return null
}
