'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type R = Record<string, any>
const db = () => createClient()
const s = (v: any) => String(v ?? '')
const n = (v: any) => Number(v ?? 0)

const SEGMENTS = [
  { key: 'sub_agent', label: 'Sub-agent' },
  { key: 'restaurant', label: 'Hotel' },
  { key: 'caterer', label: 'Caterer' },
] as const

type Mode = 'percent' | 'fixed'

type SegCell = {
  id?: string
  mode: Mode
  value: string
  dirty: boolean
  exists: boolean
}

type RowDraft = {
  itemId: string
  basePrice: string
  baseDirty: boolean
  segs: Record<string, SegCell>
}

function emptySeg(): SegCell {
  return { mode: 'percent', value: '', dirty: false, exists: false }
}

function fmt(v: number | null | undefined) {
  if (v == null || Number.isNaN(Number(v))) return '—'
  return Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

function effective(base: number | null, cell: SegCell): number | null {
  if (!cell.value || cell.value === '') return base
  if (cell.mode === 'percent') {
    if (base == null) return null
    return Math.round(base * (n(cell.value) / 100) * 1e6) / 1e6
  }
  return n(cell.value)
}

export default function PriceListManager() {
  const [items, setItems] = useState<R[]>([])
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({})
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const x = db()
    const [i, p] = await Promise.all([
      x
        .from('items')
        .select(
          'id,item_code,business_code,name,can_be_sold,is_active,default_selling_rate,selling_pack_size_kg,selling_pack_label',
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
    const itemList = i.data ?? []
    const prices = p.data ?? []
    setItems(itemList)

    const next: Record<string, RowDraft> = {}
    for (const it of itemList) {
      const id = s(it.id)
      const segs: Record<string, SegCell> = {}
      for (const seg of SEGMENTS) {
        const row = prices.find(
          (r) => s(r.item_id) === id && s(r.customer_type) === seg.key && r.is_active !== false,
        )
        if (!row) {
          segs[seg.key] = emptySeg()
        } else {
          const mode: Mode = s(row.price_mode) === 'fixed' ? 'fixed' : 'percent'
          segs[seg.key] = {
            id: s(row.id),
            mode,
            value:
              mode === 'percent'
                ? String(row.percent_of_default ?? '')
                : String(row.unit_price ?? ''),
            dirty: false,
            exists: true,
          }
        }
      }
      next[id] = {
        itemId: id,
        basePrice: it.default_selling_rate != null ? String(it.default_selling_rate) : '',
        baseDirty: false,
        segs,
      }
    }
    setDrafts(next)
    setError(false)
    setMessage('')
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((it) =>
      `${s(it.name)} ${s(it.item_code)} ${s(it.business_code)}`.toLowerCase().includes(q),
    )
  }, [items, search])

  const dirtyCount = useMemo(() => {
    let c = 0
    for (const d of Object.values(drafts)) {
      if (d.baseDirty) c++
      for (const seg of Object.values(d.segs)) if (seg.dirty) c++
    }
    return c
  }, [drafts])

  const setBase = (itemId: string, value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], basePrice: value, baseDirty: true },
    }))
  }

  const setSeg = (itemId: string, segKey: string, patch: Partial<SegCell>) => {
    setDrafts((prev) => {
      const row = prev[itemId]
      if (!row) return prev
      const cur = row.segs[segKey] || emptySeg()
      return {
        ...prev,
        [itemId]: {
          ...row,
          segs: { ...row.segs, [segKey]: { ...cur, ...patch, dirty: true } },
        },
      }
    })
  }

  const saveAll = async () => {
    setBusy(true)
    setError(false)
    setMessage('')
    const x = db()
    const now = new Date().toISOString()
    let saved = 0
    let failed = 0

    for (const d of Object.values(drafts)) {
      if (d.baseDirty) {
        const val = d.basePrice === '' ? null : n(d.basePrice)
        if (d.basePrice !== '' && !(n(d.basePrice) >= 0)) {
          failed++
        } else {
          const { error: e } = await x
            .from('items')
            .update({ default_selling_rate: val, updated_at: now })
            .eq('id', d.itemId)
          if (e) failed++
          else saved++
        }
      }

      for (const seg of SEGMENTS) {
        const cell = d.segs[seg.key]
        if (!cell?.dirty) continue

        if (!cell.value || cell.value === '') {
          if (cell.id) {
            const { error: e } = await x.from('item_customer_type_prices').delete().eq('id', cell.id)
            if (e) failed++
            else saved++
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
          item_id: d.itemId,
          customer_type: seg.key,
          price_mode: cell.mode,
          unit_price: cell.mode === 'fixed' ? n(cell.value) : null,
          percent_of_default: cell.mode === 'percent' ? n(cell.value) : null,
          rate_basis: 'kg',
          is_active: true,
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
    }

    setBusy(false)
    if (failed) {
      setError(true)
      setMessage(`Saved ${saved}, failed ${failed}. Check values and try again.`)
    } else if (!saved) {
      setMessage('No changes to save.')
    } else {
      setMessage(`Saved ${saved} change(s).`)
    }
    await load()
  }

  return (
    <div className="pl-simple">
      <div className="console-panel">
        <div className="panel-heading">
          <div>
            <h2>Price list</h2>
            <span>
              Sellable products only. <strong>Base price</strong> = direct customers. Set Sub-agent, Hotel and Caterer
              as % of base or fixed ₹/kg. Leave blank to use base.
            </span>
          </div>
          <div className="purchase-actions">
            <button className="secondary-button" type="button" disabled={busy} onClick={() => void load()}>
              Refresh
            </button>
            <button
              className="primary-button"
              type="button"
              disabled={busy || dirtyCount === 0}
              onClick={() => void saveAll()}
            >
              {busy ? 'Saving…' : dirtyCount ? `Save (${dirtyCount})` : 'Save'}
            </button>
          </div>
        </div>

        <div className="pl-toolbar">
          <input
            className="search-input"
            placeholder="Search product…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="muted">
            {filtered.length} product{filtered.length === 1 ? '' : 's'}
          </span>
        </div>

        {message && (
          <p className={`form-status${error ? ' form-status-error' : ''}`} role="alert">
            {message}
          </p>
        )}

        <div className="pl-table-wrap">
          <table className="pl-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Base price (Direct) ₹/kg</th>
                {SEGMENTS.map((seg) => (
                  <th key={seg.key}>{seg.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((it) => {
                const id = s(it.id)
                const d = drafts[id]
                if (!d) return null
                const baseNum = d.basePrice === '' ? null : n(d.basePrice)
                return (
                  <tr key={id}>
                    <td className="pl-prod">
                      <div className="pl-name">{s(it.name)}</div>
                      <div className="muted pl-code">{s(it.item_code || it.business_code)}</div>
                    </td>
                    <td className={d.baseDirty ? 'pl-dirty' : undefined}>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={d.basePrice}
                        onChange={(e) => setBase(id, e.target.value)}
                        placeholder="0"
                        className="pl-input"
                      />
                    </td>
                    {SEGMENTS.map((seg) => {
                      const cell = d.segs[seg.key] || emptySeg()
                      const eff = effective(baseNum, cell)
                      return (
                        <td key={seg.key} className={cell.dirty ? 'pl-dirty' : undefined}>
                          <div className="pl-seg">
                            <select
                              value={cell.mode}
                              onChange={(e) => setSeg(id, seg.key, { mode: e.target.value as Mode })}
                              className="pl-mode"
                            >
                              <option value="percent">%</option>
                              <option value="fixed">₹</option>
                            </select>
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={cell.value}
                              onChange={(e) => setSeg(id, seg.key, { value: e.target.value })}
                              placeholder={cell.mode === 'percent' ? 'e.g. 90' : '₹/kg'}
                              className="pl-input"
                            />
                          </div>
                          <div className="muted pl-eff">→ ₹{fmt(eff)}/kg</div>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
              {!filtered.length && (
                <tr>
                  <td colSpan={2 + SEGMENTS.length} className="table-message">
                    No sellable products. Mark items as “Can be sold” in Item Master.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="muted" style={{ marginTop: 12 }}>
          <strong>Base</strong> is for direct customers (saved on the product). <strong>%</strong> is percent of base
          (e.g. 90 = 90% of base). <strong>₹</strong> is fixed per kg. Clear a segment value to use base price.
        </p>
      </div>

      <style>{`
        .pl-simple .pl-toolbar {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          align-items: center;
          margin: 10px 0 14px;
        }
        .pl-simple .pl-table-wrap {
          overflow: auto;
          border: 1px solid var(--border);
          border-radius: 12px;
          max-height: min(70vh, 720px);
        }
        .pl-simple .pl-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
          min-width: 720px;
        }
        .pl-simple .pl-table th,
        .pl-simple .pl-table td {
          padding: 12px 14px;
          border-bottom: 1px solid var(--border);
          text-align: left;
          vertical-align: top;
        }
        .pl-simple .pl-table thead th {
          position: sticky;
          top: 0;
          background: var(--accent-soft);
          font-weight: 700;
          z-index: 1;
        }
        .pl-simple .pl-name {
          font-weight: 600;
        }
        .pl-simple .pl-code {
          font-size: 12px;
        }
        .pl-simple .pl-seg {
          display: flex;
          gap: 6px;
          align-items: center;
        }
        .pl-simple .pl-mode {
          width: 56px;
          padding: 8px 6px;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text);
        }
        .pl-simple .pl-input {
          width: 100px;
          padding: 8px 10px;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text);
        }
        .pl-simple .pl-eff {
          margin-top: 4px;
          font-size: 12px;
          font-variant-numeric: tabular-nums;
        }
        .pl-simple .pl-dirty {
          background: color-mix(in srgb, var(--accent) 10%, var(--surface));
        }
      `}</style>
    </div>
  )
}
