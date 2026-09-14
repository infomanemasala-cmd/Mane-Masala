'use client'

import { useEffect, useState } from 'react'

const themes = [
  { id: 'spice', label: 'Spice Garden', description: 'Warm cream, green and earthy accents' },
  { id: 'turmeric', label: 'Turmeric Market', description: 'Golden, lively and food-forward' },
  { id: 'heritage', label: 'Heritage Masala', description: 'Deep, rich and traditional' },
]

export default function ThemePicker() {
  const [theme, setTheme] = useState('spice')
  useEffect(() => { const saved = localStorage.getItem('mane-masala-theme') || 'spice'; setTheme(saved); document.documentElement.dataset.theme = saved }, [])
  const change = (value: string) => { setTheme(value); localStorage.setItem('mane-masala-theme', value); document.documentElement.dataset.theme = value }
  return <label className="theme-picker"><span>Theme</span><select value={theme} onChange={e => change(e.target.value)} aria-label="Choose visual theme">{themes.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
}
