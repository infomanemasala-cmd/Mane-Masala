'use client'

import { useEffect } from 'react'

function hintFor(label: string, input: HTMLInputElement) {
  const l = label.toLowerCase()
  if (l.includes('date')) return 'DD-MM-YYYY'
  if (l.includes('phone') || l.includes('mobile')) return '10-digit mobile number'
  if (l.includes('email')) return 'name@example.com'
  if (l.includes('invoice')) return 'Supplier invoice number, if shown on bill'
  if (l.includes('reference') || l.includes('ref')) return 'Reference number'
  if (l.includes('rate')) return '₹ 0.00'
  if (l.includes('amount') || l.includes('price') || l.includes('charge') || l.includes('discount')) return '₹ 0.00'
  if (l.includes('percent') || l.includes('%') || l.includes('tax')) return '0.00 %'
  if (l.includes('quantity') || l.includes('qty') || l.includes('output') || l.includes('consumption')) return '0.000 — enter the unit shown'
  if (l.includes('code')) return 'Business / item code'
  if (l.includes('address')) return 'House / street / area'
  if (l.includes('note') || l.includes('remark') || l.includes('reason')) return 'Enter a short note'
  if (l.includes('description')) return 'Enter a short description'
  if (input.type === 'number') return '0.00'
  return ''
}

export default function FormGuidance() {
  useEffect(() => {
    const apply = () => {
      document.querySelectorAll<HTMLElement>('.field, .form-field, .form-stack label').forEach(field => {
        const label = field.querySelector('span')?.textContent || field.textContent || ''
        const input = field.querySelector<HTMLInputElement>('input:not([type="hidden"]):not([readonly]), textarea')
        if (!input || input.placeholder) return
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
