'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type R = Record<string, any>
const db = () => createClient()
const s = (v: any) => String(v ?? '')
const n = (v: any) => Number(v ?? 0)

const CUSTOMER_TYPES = [
  ['individual', 'Individual'],
  ['retail_shop', 'Retail shop'],
  ['restaurant', 'Restaurant'],
  ['caterer', 'Caterer'],
  ['online_customer', 'Online'],
  ['sub_agent', 'Sub-agent'],
] as const

type Ct = (typeof CUSTOMER_TYPES)[number][0]
type Mode = 'fixed' | 'percent' | ''

type Cell = {
  id?: string
  mode: Mode
  value: string
  rateBasis: 'kg' | 'pack'
  isActive: boolean
  dirty?: boolean
}

type DraftMap = Record<string, Cell>

function cellKey(itemId: string, ct: string) {
  return `${itemId}::${ct}`
}

function fmtMoney(v: number | null | undefined) {
  if (v == null || Number.isNaN(Number(v))) return '—'
  return Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

function computePreview(item: R, cell: Cell | undefined): number | null {
  if (!cell || !cell.mode) return item.default_selling_rate != null ? n(item.default_selling_rate) : null
  if (cell.mode === 'percent') {
    const d = n(item.default_selling_rate)
    if (!d) return null
    return Math.round(d * (n(cell.value) / 100) * 1e6) / 1e6
  }
  let price = n(cell.value)
  if (cell.rateBasis === 'pack') {
    const pack = n(item.selling_pack_size_kg)
    if (pack > 0) price = price / pack
  }
  return price
}

export default function PriceListManager() {
  const [items, setItems] = useState<R[]>([])
  const [draft, setDraft] = useState<DraftMap>({})
  const [search, setSearch] = useState('')
  const [onlyMissing, setOnlyMissing] = useState(false)
  const [onlyDirty, setOnlyDirty] = useState(false)
  const [visibleTypes, setVisibleTypes] = useState<string[]>(CUSTOMER_TYPES.map((c) => c[0]))
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [bulkMode, setBulkMode] = useState<'percent' | 'fixed'>('percent')
  const [bulkValue, setBulkValue] = useState('90')
  const [bulkCt, setBulkCt] = useState<string>('__all__')
  const [bulkBasis, setBulkBasis] = useState<'kg' | 'pack'>('kg')

  const load = useCallback(async () => {
    const x = db()
    const [i, p] = await Promise.all([
      x
        .from('items')
        .select(
          'id,item_code,business_code,name,can_be_sold,is_active,default_selling_rate,selling_pack_size_kg,selling_pack_label,selling_pack_type',
        )
        .eq('is_active', true)
        .eq('can_be_sold', true)
        .order('name'),
      x.from('item_customer_type_prices').select('*'),
    ])
    if (i.error || p.error) {
      setError(true)
      setMessage(i.error?.message || p.error?.message || 'Load failed')
      return
    }
    setItems(i.data ?? [])
    const next: DraftMap = {}
    for (const r of p.data ?? []) {
      const mode = (s(r.price_mode) === 'percent' ? 'percent' : 'fixed') as Mode
      next[cellKey(s(r.item_id), s(r.customer_type))] = {
        id: s(r.id),
        mode,
        value: mode === 'percent' ? String(r.percent_of_default ?? '') : String(r.unit_price ?? ''),
        rateBasis: s(r.rate_basis) === 'pack' ? 'pack' : 'kg',
        isActive: r.is_active !== false,
        dirty: false,
      }
    }
    setDraft(next)
    setError(false)
    setMessage('')
    setSelectedItems([])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const dirtyCount = useMemo(() => Object.values(draft).filter((c) => c.dirty).length, [draft])

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((it) => {
      if (q) {
        const hay = `${s(it.name)} ${s(it.item_code)} ${s(it.business_code)}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (onlyDirty) {
        const anyDirty = CUSTOMER_TYPES.some(([ct]) => draft[cellKey(s(it.id), ct)]?.dirty)
        if (!anyDirty) return false
      }
      if (onlyMissing) {
        const missing = CUSTOMER_TYPES.some(([ct]) => {
          if (!visibleTypes.includes(ct)) return false
          const c = draft[cellKey(s(it.id), ct)]
          return !c || !c.mode || !c.isActive
        })
        if (!missing) return false
      }
      return true
    })
  }, [items, search, onlyMissing, onlyDirty, draft, visibleTypes])

  const setCell = (itemId: string, ct: string, patch: Partial<Cell>) => {
    const key = cellKey(itemId, ct)
    setDraft((prev) => {
      const cur = prev[key] || { mode: '' as Mode, value: '', rateBasis: 'kg' as const, isActive: true }
      return { ...prev, [key]: { ...cur, ...patch, dirty: true } }
    })
  }

  const clearCell = (itemId: string, ct: string) => {
    const key = cellKey(itemId, ct)
    setDraft((prev) => {
      const cur = prev[key]
      if (!cur) return prev
      return {
        ...prev,
        [key]: { ...cur, mode: '', value: '', dirty: true, isActive: false },
      }
    })
  }

  const toggleSelect = (id: string) => {
    setSelectedItems((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const selectAllVisible = () => {
    const ids = filteredItems.map((i) => s(i.id))
    const allSelected = ids.length > 0 && ids.every((id) => selectedItems.includes(id))
    setSelectedItems(allSelected ? [] : ids)
  }

  const applyBulk = () => {
    const targets = selectedItems.length ? selectedItems : filteredItems.map((i) => s(i.id))
    if (!targets.length) {
      setError(true)
      setMessage('Select products (checkboxes) or clear filters so the visible list is the target.')
      return
    }
    if (bulkMode === 'percent' && !(n(bulkValue) > 0)) {
      setError(true)
      setMessage('Bulk percent must be greater than 0.')
      return
    }
    if (bulkMode === 'fixed' && !(n(bulkValue) >= 0)) {
      setError(true)
      setMessage('Bulk fixed price must be 0 or more.')
      return
    }
    const types = bulkCt === '__all__' ? visibleTypes : [bulkCt]
    setDraft((prev) => {
      const next = { ...prev }
      for (const itemId of targets) {
        for (const ct of types) {
          const key = cellKey(itemId, ct)
          const cur = next[key] || { mode: '' as Mode, value: '', rateBasis: 'kg' as const, isActive: true }
          next[key] = {
            ...cur,
            mode: bulkMode,
            value: bulkValue,
            rateBasis: bulkMode === 'fixed' ? bulkBasis : 'kg',
            isActive: true,
            dirty: true,
          }
        }
      }
      return next
    })
    setError(false)
    setMessage(
      `Applied ${bulkMode === 'percent' ? bulkValue + '%' : '₹' + bulkValue} to ${targets.length} product(s) × ${types.length} type(s). Click Save all to persist.`,
    )
  }

  const fillFromDefault = (pct: number) => {
    const targets = selectedItems.length ? selectedItems : filteredItems.map((i) => s(i.id))
    const types = bulkCt === '__all__' ? visibleTypes : [bulkCt]
    setDraft((prev) => {
      const next = { ...prev }
      for (const itemId of targets) {
        for (const ct of types) {
          const key = cellKey(itemId, ct)
          const cur = next[key] || { mode: '' as Mode, value: '', rateBasis: 'kg' as const, isActive: true }
          next[key] = {
            ...cur,
            mode: 'percent',
            value: String(pct),
            rateBasis: 'kg',
            isActive: true,
            dirty: true,
          }
        }
      }
      return next
    })
    setMessage(`Set ${pct}% of default for ${targets.length} product(s). Click Save all.`)
  }

  const saveAll = async () => {
    const dirtyEntries = Object.entries(draft).filter(([, c]) => c.dirty)
    if (!dirtyEntries.length) {
      setMessage('No changes to save.')
      return
    }
    setBusy(true)
    setError(false)
    setMessage('')
    const x = db()
    const now = new Date().toISOString()
    let failed = 0
    let saved = 0
    let removed = 0

    for (const [key, cell] of dirtyEntries) {
      const [itemId, customerType] = key.split('::')
      if (!cell.mode || cell.value === '') {
        if (cell.id) {
          const { error: e } = await x.from('item_customer_type_prices').delete().eq('id', cell.id)
          if (e) failed++
          else removed++
        }
        continue
      }
      if (cell.mode === 'percent' && !(n(cell.value) > 0)) {
        failed++
        continue
      }
      if (cell.mode === 'fixed' && !(n(cell.value) >= 0)) {
        failed++
        continue
      }
      const payload = {
        item_id: itemId,
        customer_type: customerType,
        price_mode: cell.mode,
        unit_price: cell.mode === 'fixed' ? n(cell.value) : null,
        percent_of_default: cell.mode === 'percent' ? n(cell.value) : null,
        rate_basis: cell.mode === 'fixed' ? cell.rateBasis : 'kg',
        is_active: cell.isActive !== false,
        updated_at: now,
      }
      if (cell.id) {
        const { error: e } = await x.from('item_customer_type_prices').update(payload).eq('id', cell.id)
        if (e) failed++
        else saved++
      } else {
        const { error: e } = await x
          .from('item_customer_type_prices')
          .upsert(payload, { onConflict: 'item_id,customer_type' })
        if (e) failed++
        else saved++
      }
    }

    setBusy(false)
    if (failed) {
      setError(true)
      setMessage(`Saved ${saved}, removed ${removed}, failed ${failed}. Reload and retry failed cells.`)
    } else {
      setMessage(`Saved ${saved} price(s)${removed ? `, removed ${removed}` : ''}.`)
    }
    await load()
  }

  const discard = async () => {
    if (dirtyCount && !window.confirm(`Discard ${dirtyCount} unsaved change(s)?`)) return
    await load()
  }

  const toggleType = (ct: string) => {
    setVisibleTypes((prev) => {
      if (prev.includes(ct)) {
        if (prev.length === 1) return prev
        return prev.filter((x) => x !== ct)
      }
      return [...prev, ct]
    })
  }

  return (
    <div className="price-list-advanced">
      <div className="console-panel">
        <div className="panel-heading">
          <div>
            <h2>Price list</h2>
            <span>
              Matrix by product × customer type. Edit inline, bulk-fill, then <strong>Save all</strong>. Empty cell =
              use item default rate.
            </span>
          </div>
          <div className="purchase-actions">
            <button className="secondary-button" type="button" disabled={busy} onClick={() => void discard()}>
              Discard
            </button>
            <button
              className="primary-button"
              type="button"
              disabled={busy || dirtyCount === 0}
              onClick={() => void saveAll()}
            >
              {busy ? 'Saving…' : `Save all${dirtyCount ? ` (${dirtyCount})` : ''}`}
            </button>
          </div>
        </div>

        <div className="pl-toolbar">
          <input
            className="search-input"
            placeholder="Search product name or code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <label className="pl-check">
            <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />
            Missing prices
          </label>
          <label className="pl-check">
            <input type="checkbox" checked={onlyDirty} onChange={(e) => setOnlyDirty(e.target.checked)} />
            Unsaved only
          </label>
          <span className="muted pl-count">
            {filteredItems.length} product{filteredItems.length === 1 ? '' : 's'}
            {selectedItems.length ? ` · ${selectedItems.length} selected` : ''}
          </span>
        </div>

        <div className="pl-types">
          <span className="muted">Columns:</span>
          {CUSTOMER_TYPES.map(([ct, label]) => (
            <label key={ct} className="pl-check">
              <input type="checkbox" checked={visibleTypes.includes(ct)} onChange={() => toggleType(ct)} />
              {label}
            </label>
          ))}
        </div>

        <div className="pl-bulk">
          <strong>Bulk fill</strong>
          <select value={bulkCt} onChange={(e) => setBulkCt(e.target.value)}>
            <option value="__all__">All visible types</option>
            {CUSTOMER_TYPES.map(([ct, label]) => (
              <option key={ct} value={ct}>
                {label}
              </option>
            ))}
          </select>
          <select value={bulkMode} onChange={(e) => setBulkMode(e.target.value as 'percent' | 'fixed')}>
            <option value="percent">% of default</option>
            <option value="fixed">Fixed ₹ / kg or pack</option>
          </select>
          <input
            type="number"
            min={bulkMode === 'percent' ? 0.01 : 0}
            step="0.01"
            value={bulkValue}
            onChange={(e) => setBulkValue(e.target.value)}
            style={{ width: 100 }}
          />
          {bulkMode === 'fixed' && (
            <select value={bulkBasis} onChange={(e) => setBulkBasis(e.target.value as 'kg' | 'pack')}>
              <option value="kg">per kg</option>
              <option value="pack">per pack</option>
            </select>
          )}
          <button className="secondary-button" type="button" disabled={busy} onClick={applyBulk}>
            Apply to {selectedItems.length ? 'selected' : 'visible'}
          </button>
          <button className="secondary-button" type="button" disabled={busy} onClick={() => fillFromDefault(100)}>
            100% default
          </button>
          <button className="secondary-button" type="button" disabled={busy} onClick={() => fillFromDefault(90)}>
            90%
          </button>
          <button className="secondary-button" type="button" disabled={busy} onClick={() => fillFromDefault(85)}>
            85%
          </button>
        </div>

        {message && (
          <p className={`form-status${error ? ' form-status-error' : ''}`} role="alert">
            {message}
          </p>
        )}

        <div className="pl-matrix-wrap">
          <table className="pl-matrix">
            <thead>
              <tr>
                <th className="pl-sticky-col">
                  <label className="pl-check">
                    <input
                      type="checkbox"
                      checked={
                        filteredItems.length > 0 && filteredItems.every((i) => selectedItems.includes(s(i.id)))
                      }
                      onChange={selectAllVisible}
                      aria-label="Select all visible"
                    />
                  </label>
                </th>
                <th className="pl-sticky-col pl-product">Product</th>
                <th>Default ₹/kg</th>
                <th>Pack</th>
                {CUSTOMER_TYPES.filter(([ct]) => visibleTypes.includes(ct)).map(([ct, label]) => (
                  <th key={ct}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((it) => {
                const id = s(it.id)
                const selected = selectedItems.includes(id)
                return (
                  <tr key={id} className={selected ? 'pl-row-selected' : undefined}>
                    <td className="pl-sticky-col">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleSelect(id)}
                        aria-label={`Select ${s(it.name)}`}
                      />
                    </td>
                    <td className="pl-sticky-col pl-product">
                      <div className="pl-product-name">{s(it.name)}</div>
                      <div className="muted pl-product-code">{s(it.item_code || it.business_code)}</div>
                    </td>
                    <td className="pl-default">{fmtMoney(it.default_selling_rate)}</td>
                    <td className="muted">
                      {s(it.selling_pack_label) ||
                        (n(it.selling_pack_size_kg) > 0 ? `${it.selling_pack_size_kg} kg` : '—')}
                    </td>
                    {CUSTOMER_TYPES.filter(([ct]) => visibleTypes.includes(ct)).map(([ct]) => {
                      const key = cellKey(id, ct)
                      const cell = draft[key]
                      const preview = computePreview(it, cell)
                      const isDirty = Boolean(cell?.dirty)
                      return (
                        <td key={ct} className={`pl-cell${isDirty ? ' pl-cell-dirty' : ''}`}>
                          <div className="pl-cell-inner">
                            <div className="pl-cell-row">
                              <select
                                value={cell?.mode || ''}
                                onChange={(e) => {
                                  const mode = e.target.value as Mode
                                  if (!mode) {
                                    clearCell(id, ct)
                                    return
                                  }
                                  setCell(id, ct, {
                                    mode,
                                    value:
                                      mode === 'percent'
                                        ? cell?.mode === 'percent'
                                          ? cell.value
                                          : '100'
                                        : cell?.mode === 'fixed'
                                          ? cell.value
                                          : s(it.default_selling_rate || ''),
                                    rateBasis: 'kg',
                                    isActive: true,
                                  })
                                }
                                aria-label="Price mode"
                              >
                                <option value="">Default</option>
                                <option value="percent">%</option>
                                <option value="fixed">₹</option>
                              </select>
                              {cell?.mode ? (
                                <input
                                  type="number"
                                  min={cell.mode === 'percent' ? 0.01 : 0}
                                  step="0.01"
                                  value={cell.value}
                                  onChange={(e) => setCell(id, ct, { value: e.target.value })}
                                  aria-label="Price value"
                                />
                              ) : (
                                <span className="pl-empty">—</span>
                              )}
                            </div>
                            {cell?.mode === 'fixed' && n(it.selling_pack_size_kg) > 0 && (
                              <select
                                className="pl-basis"
                                value={cell.rateBasis}
                                onChange={(e) => setCell(id, ct, { rateBasis: e.target.value as 'kg' | 'pack' })}
                              >
                                <option value="kg">/kg</option>
                                <option value="pack">/pack</option>
                              </select>
                            )}
                            <div className="pl-preview muted">
                              → ₹{fmtMoney(preview)}
                              {cell?.mode === 'percent' ? '/kg' : cell?.rateBasis === 'pack' ? ' eff./kg' : '/kg'}
                            </div>
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
              {!filteredItems.length && (
                <tr>
                  <td colSpan={4 + visibleTypes.length} className="table-message">
                    No sellable products match. Activate products with Can be sold, or clear filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="muted" style={{ marginTop: 12 }}>
          <strong>%</strong> = percent of item default selling rate (always per kg). <strong>₹</strong> = fixed price;
          choose /kg or /pack when the product has a pack size. Orders resolve: price list → default rate → manual.
        </p>
      </div>

      <style>{`
        .price-list-advanced .pl-toolbar,
        .price-list-advanced .pl-types,
        .price-list-advanced .pl-bulk {
          display: flex;
          flex-wrap: wrap;
          gap: 10px 14px;
          align-items: center;
          margin: 10px 0 12px;
        }
        .price-list-advanced .pl-check {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: var(--text);
        }
        .price-list-advanced .pl-count {
          margin-left: auto;
          font-size: 13px;
        }
        .price-list-advanced .pl-bulk {
          padding: 12px 14px;
          border: 1px solid var(--border);
          border-radius: 12px;
          background: var(--accent-soft);
        }
        .price-list-advanced .pl-bulk strong {
          margin-right: 4px;
        }
        .price-list-advanced .pl-bulk select,
        .price-list-advanced .pl-bulk input {
          padding: 6px 8px;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text);
        }
        .price-list-advanced .pl-matrix-wrap {
          overflow: auto;
          max-height: min(70vh, 720px);
          border: 1px solid var(--border);
          border-radius: 12px;
        }
        .price-list-advanced .pl-matrix {
          border-collapse: separate;
          border-spacing: 0;
          width: max-content;
          min-width: 100%;
          font-size: 13px;
        }
        .price-list-advanced .pl-matrix th,
        .price-list-advanced .pl-matrix td {
          border-bottom: 1px solid var(--border);
          border-right: 1px solid var(--border);
          padding: 8px 10px;
          vertical-align: top;
          background: var(--surface);
        }
        .price-list-advanced .pl-matrix thead th {
          position: sticky;
          top: 0;
          z-index: 2;
          background: var(--accent-soft);
          font-weight: 700;
          text-align: left;
        }
        .price-list-advanced .pl-sticky-col {
          position: sticky;
          left: 0;
          z-index: 1;
          background: var(--surface);
        }
        .price-list-advanced thead .pl-sticky-col {
          z-index: 3;
          background: var(--accent-soft);
        }
        .price-list-advanced .pl-product {
          min-width: 180px;
          left: 36px;
        }
        .price-list-advanced .pl-product-name {
          font-weight: 600;
        }
        .price-list-advanced .pl-product-code {
          font-size: 12px;
        }
        .price-list-advanced .pl-default {
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }
        .price-list-advanced .pl-cell-dirty {
          background: color-mix(in srgb, var(--accent) 12%, var(--surface));
        }
        .price-list-advanced .pl-row-selected td {
          background: color-mix(in srgb, var(--accent) 8%, var(--surface));
        }
        .price-list-advanced .pl-cell-inner {
          min-width: 132px;
        }
        .price-list-advanced .pl-cell-row {
          display: flex;
          gap: 4px;
          align-items: center;
        }
        .price-list-advanced .pl-cell-row select {
          width: 64px;
          padding: 4px;
          border-radius: 6px;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text);
        }
        .price-list-advanced .pl-cell-row input {
          width: 72px;
          padding: 4px 6px;
          border-radius: 6px;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text);
        }
        .price-list-advanced .pl-basis {
          margin-top: 4px;
          width: 100%;
          padding: 3px 4px;
          border-radius: 6px;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text);
          font-size: 12px;
        }
        .price-list-advanced .pl-preview {
          margin-top: 4px;
          font-size: 11px;
          font-variant-numeric: tabular-nums;
        }
        .price-list-advanced .pl-empty {
          color: var(--muted);
          padding: 0 4px;
        }
        @media (max-width: 800px) {
          .price-list-advanced .pl-product {
            min-width: 140px;
          }
        }
      `}</style>
    </div>
  )
}
