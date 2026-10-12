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
  ['online_customer', 'Online customer'],
  ['sub_agent', 'Sub-agent'],
] as const

type Mode = 'default' | 'percent' | 'fixed'

type SegRow = {
  id?: string
  mode: Mode
  value: string
  rateBasis: 'kg' | 'pack'
  dirty: boolean
}

function emptySeg(): SegRow {
  return { mode: 'default', value: '', rateBasis: 'kg', dirty: false }
}

function fmtMoney(v: number | null | undefined) {
  if (v == null || Number.isNaN(Number(v))) return '—'
  return Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

function previewRate(item: R | null, row: SegRow): number | null {
  if (!item) return null
  const def = item.default_selling_rate != null ? n(item.default_selling_rate) : null
  if (row.mode === 'default' || !row.mode) return def
  if (row.mode === 'percent') {
    if (def == null) return null
    return Math.round(def * (n(row.value) / 100) * 1e6) / 1e6
  }
  let price = n(row.value)
  if (row.rateBasis === 'pack') {
    const pack = n(item.selling_pack_size_kg)
    if (pack > 0) price = price / pack
  }
  return price
}

export default function PriceListManager() {
  const [items, setItems] = useState<R[]>([])
  const [priceRows, setPriceRows] = useState<R[]>([])
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [segs, setSegs] = useState<Record<string, SegRow>>({})
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)

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
    setPriceRows(p.data ?? [])
    setError(false)
    setMessage('')
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((it) =>
      `${s(it.name)} ${s(it.item_code)} ${s(it.business_code)}`.toLowerCase().includes(q),
    )
  }, [items, search])

  const selected = useMemo(() => items.find((i) => s(i.id) === selectedId) || null, [items, selectedId])

  const buildSegsForItem = useCallback(
    (itemId: string) => {
      const next: Record<string, SegRow> = {}
      for (const [ct] of CUSTOMER_TYPES) {
        const existing = priceRows.find(
          (r) => s(r.item_id) === itemId && s(r.customer_type) === ct && r.is_active !== false,
        )
        if (!existing) {
          next[ct] = emptySeg()
          continue
        }
        const mode: Mode = s(existing.price_mode) === 'percent' ? 'percent' : 'fixed'
        next[ct] = {
          id: s(existing.id),
          mode,
          value:
            mode === 'percent'
              ? String(existing.percent_of_default ?? '')
              : String(existing.unit_price ?? ''),
          rateBasis: s(existing.rate_basis) === 'pack' ? 'pack' : 'kg',
          dirty: false,
        }
      }
      return next
    },
    [priceRows],
  )

  const selectProduct = (id: string) => {
    setSelectedId(id)
    setSegs(buildSegsForItem(id))
    setMessage('')
    setError(false)
  }

  useEffect(() => {
    if (selectedId) setSegs(buildSegsForItem(selectedId))
  }, [priceRows, selectedId, buildSegsForItem])

  const dirtyCount = useMemo(() => Object.values(segs).filter((r) => r.dirty).length, [segs])

  const setSeg = (ct: string, patch: Partial<SegRow>) => {
    setSegs((prev) => ({
      ...prev,
      [ct]: { ...(prev[ct] || emptySeg()), ...patch, dirty: true },
    }))
  }

  const applyAllPercent = (pct: string) => {
    setSegs((prev) => {
      const next: Record<string, SegRow> = { ...prev }
      for (const [ct] of CUSTOMER_TYPES) {
        next[ct] = {
          ...(next[ct] || emptySeg()),
          mode: 'percent',
          value: pct,
          rateBasis: 'kg',
          dirty: true,
        }
      }
      return next
    })
    setMessage(`All segments set to ${pct}% of default. Save to apply.`)
    setError(false)
  }

  const applyAllDefault = () => {
    setSegs((prev) => {
      const next: Record<string, SegRow> = { ...prev }
      for (const [ct] of CUSTOMER_TYPES) {
        next[ct] = { ...(next[ct] || emptySeg()), mode: 'default', value: '', dirty: true }
      }
      return next
    })
    setMessage('All segments set to use default rate. Save to apply (removes custom rows).')
    setError(false)
  }

  const save = async () => {
    if (!selectedId || !selected) {
      setError(true)
      setMessage('Select a product first.')
      return
    }
    setBusy(true)
    setError(false)
    setMessage('')
    const x = db()
    const now = new Date().toISOString()
    let saved = 0
    let removed = 0
    let failed = 0

    for (const [ct, row] of Object.entries(segs)) {
      if (!row.dirty) continue

      if (row.mode === 'default') {
        if (row.id) {
          const { error: e } = await x.from('item_customer_type_prices').delete().eq('id', row.id)
          if (e) failed++
          else removed++
        }
        continue
      }

      if (row.mode === 'percent' && !(n(row.value) > 0)) {
        failed++
        continue
      }
      if (row.mode === 'fixed' && (row.value === '' || !(n(row.value) >= 0))) {
        failed++
        continue
      }

      const payload = {
        item_id: selectedId,
        customer_type: ct,
        price_mode: row.mode,
        unit_price: row.mode === 'fixed' ? n(row.value) : null,
        percent_of_default: row.mode === 'percent' ? n(row.value) : null,
        rate_basis: row.mode === 'fixed' ? row.rateBasis : 'kg',
        is_active: true,
        updated_at: now,
      }

      if (row.id) {
        const { error: e } = await x.from('item_customer_type_prices').update(payload).eq('id', row.id)
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
      setMessage(`Saved ${saved}, removed ${removed}, failed ${failed}. Check values and try again.`)
    } else if (!saved && !removed) {
      setMessage('No changes to save.')
    } else {
      setMessage(
        `Saved for ${s(selected.name)}: ${saved} segment(s)${removed ? `, ${removed} reset to default` : ''}.`,
      )
    }
    await load()
  }

  const hasPack = selected ? n(selected.selling_pack_size_kg) > 0 : false

  return (
    <div className="pl-one-product">
      <div className="console-panel">
        <div className="panel-heading">
          <div>
            <h2>Price list</h2>
            <span>
              Select <strong>one product</strong>, set rates for every customer segment (% or ₹), then save.
            </span>
          </div>
        </div>

        <div className="pl-layout">
          <div className="pl-products">
            <input
              className="search-input"
              placeholder="Search product…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="pl-product-list">
              {filteredItems.map((it) => {
                const id = s(it.id)
                const active = id === selectedId
                const hasAny = priceRows.some((r) => s(r.item_id) === id && r.is_active !== false)
                return (
                  <button
                    key={id}
                    type="button"
                    className={`pl-product-btn${active ? ' active' : ''}`}
                    onClick={() => selectProduct(id)}
                  >
                    <span className="pl-product-btn-name">{s(it.name)}</span>
                    <span className="muted">
                      {s(it.item_code || it.business_code)}
                      {hasAny ? ' · custom prices' : ''}
                    </span>
                  </button>
                )
              })}
              {!filteredItems.length && <p className="muted table-message">No sellable products found.</p>}
            </div>
          </div>

          <div className="pl-form">
            {!selected ? (
              <div className="pl-empty-state">
                <h3>Choose a product</h3>
                <p className="muted">
                  Pick a product on the left to enter rates for all customer segments in one form.
                </p>
              </div>
            ) : (
              <>
                <div className="pl-form-header">
                  <div>
                    <h3>{s(selected.name)}</h3>
                    <p className="muted">
                      {s(selected.item_code || selected.business_code)}
                      {' · '}
                      Default ₹{fmtMoney(selected.default_selling_rate)}/kg
                      {hasPack
                        ? ` · Pack: ${s(selected.selling_pack_label) || selected.selling_pack_size_kg + ' kg'}`
                        : ''}
                    </p>
                  </div>
                  <div className="purchase-actions">
                    <button className="secondary-button" type="button" disabled={busy} onClick={applyAllDefault}>
                      All → default
                    </button>
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={busy}
                      onClick={() => applyAllPercent('100')}
                    >
                      All 100%
                    </button>
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={busy}
                      onClick={() => applyAllPercent('90')}
                    >
                      All 90%
                    </button>
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={busy}
                      onClick={() => applyAllPercent('85')}
                    >
                      All 85%
                    </button>
                    <button
                      className="primary-button"
                      type="button"
                      disabled={busy || dirtyCount === 0}
                      onClick={() => void save()}
                    >
                      {busy ? 'Saving…' : dirtyCount ? `Save (${dirtyCount})` : 'Save'}
                    </button>
                  </div>
                </div>

                {message && (
                  <p className={`form-status${error ? ' form-status-error' : ''}`} role="alert">
                    {message}
                  </p>
                )}

                <div className="pl-seg-table-wrap">
                  <table className="pl-seg-table">
                    <thead>
                      <tr>
                        <th>Customer segment</th>
                        <th>Price type</th>
                        <th>Value</th>
                        <th>Basis</th>
                        <th>Effective ₹/kg</th>
                      </tr>
                    </thead>
                    <tbody>
                      {CUSTOMER_TYPES.map(([ct, label]) => {
                        const row = segs[ct] || emptySeg()
                        const prev = previewRate(selected, row)
                        return (
                          <tr key={ct} className={row.dirty ? 'pl-row-dirty' : undefined}>
                            <td>
                              <strong>{label}</strong>
                            </td>
                            <td>
                              <select
                                value={row.mode}
                                onChange={(e) => {
                                  const mode = e.target.value as Mode
                                  if (mode === 'default') {
                                    setSeg(ct, { mode: 'default', value: '' })
                                  } else if (mode === 'percent') {
                                    setSeg(ct, {
                                      mode: 'percent',
                                      value: row.mode === 'percent' && row.value ? row.value : '100',
                                      rateBasis: 'kg',
                                    })
                                  } else {
                                    setSeg(ct, {
                                      mode: 'fixed',
                                      value:
                                        row.mode === 'fixed' && row.value
                                          ? row.value
                                          : s(selected.default_selling_rate ?? ''),
                                      rateBasis: 'kg',
                                    })
                                  }
                                }}
                              >
                                <option value="default">Use default rate</option>
                                <option value="percent">% of default</option>
                                <option value="fixed">Fixed amount (₹)</option>
                              </select>
                            </td>
                            <td>
                              {row.mode === 'default' ? (
                                <span className="muted">—</span>
                              ) : (
                                <input
                                  type="number"
                                  min={row.mode === 'percent' ? 0.01 : 0}
                                  step="0.01"
                                  value={row.value}
                                  onChange={(e) => setSeg(ct, { value: e.target.value })}
                                  placeholder={row.mode === 'percent' ? 'e.g. 90' : 'e.g. 450'}
                                  style={{ width: 120 }}
                                />
                              )}
                              {row.mode === 'percent' && <span className="muted"> %</span>}
                              {row.mode === 'fixed' && <span className="muted"> ₹</span>}
                            </td>
                            <td>
                              {row.mode === 'fixed' && hasPack ? (
                                <select
                                  value={row.rateBasis}
                                  onChange={(e) => setSeg(ct, { rateBasis: e.target.value as 'kg' | 'pack' })}
                                >
                                  <option value="kg">per kg</option>
                                  <option value="pack">per pack</option>
                                </select>
                              ) : row.mode === 'fixed' ? (
                                <span className="muted">per kg</span>
                              ) : (
                                <span className="muted">—</span>
                              )}
                            </td>
                            <td className="pl-eff">₹{fmtMoney(prev)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <p className="muted" style={{ marginTop: 12 }}>
                  <strong>Use default</strong> = no special price (order uses item default selling rate).{' '}
                  <strong>% of default</strong> = e.g. 90 means 90% of default ₹/kg.{' '}
                  <strong>Fixed amount</strong> = enter ₹ per kg or per pack.
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .pl-one-product .pl-layout {
          display: grid;
          grid-template-columns: minmax(220px, 280px) 1fr;
          gap: 16px;
          margin-top: 8px;
          min-height: 420px;
        }
        .pl-one-product .pl-products {
          display: flex;
          flex-direction: column;
          gap: 8px;
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 10px;
          background: var(--surface);
        }
        .pl-one-product .pl-product-list {
          overflow: auto;
          max-height: min(62vh, 560px);
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .pl-one-product .pl-product-btn {
          text-align: left;
          border: 1px solid transparent;
          background: transparent;
          border-radius: 10px;
          padding: 10px 12px;
          cursor: pointer;
          color: var(--text);
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .pl-one-product .pl-product-btn:hover {
          background: var(--accent-soft);
        }
        .pl-one-product .pl-product-btn.active {
          border-color: var(--accent);
          background: var(--accent-soft);
        }
        .pl-one-product .pl-product-btn-name {
          font-weight: 600;
          font-size: 14px;
        }
        .pl-one-product .pl-form {
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 16px 18px;
          background: var(--surface);
        }
        .pl-one-product .pl-empty-state {
          display: grid;
          place-items: center;
          min-height: 280px;
          text-align: center;
          padding: 24px;
        }
        .pl-one-product .pl-form-header {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 12px;
        }
        .pl-one-product .pl-form-header h3 {
          margin: 0 0 4px;
          font-size: 1.2rem;
        }
        .pl-one-product .pl-seg-table-wrap {
          overflow: auto;
          border: 1px solid var(--border);
          border-radius: 12px;
        }
        .pl-one-product .pl-seg-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }
        .pl-one-product .pl-seg-table th,
        .pl-one-product .pl-seg-table td {
          padding: 12px 14px;
          border-bottom: 1px solid var(--border);
          text-align: left;
          vertical-align: middle;
        }
        .pl-one-product .pl-seg-table thead th {
          background: var(--accent-soft);
          font-weight: 700;
        }
        .pl-one-product .pl-seg-table select,
        .pl-one-product .pl-seg-table input {
          padding: 8px 10px;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text);
        }
        .pl-one-product .pl-row-dirty td {
          background: color-mix(in srgb, var(--accent) 10%, var(--surface));
        }
        .pl-one-product .pl-eff {
          font-variant-numeric: tabular-nums;
          font-weight: 600;
          white-space: nowrap;
        }
        @media (max-width: 900px) {
          .pl-one-product .pl-layout {
            grid-template-columns: 1fr;
          }
          .pl-one-product .pl-product-list {
            max-height: 200px;
          }
        }
      `}</style>
    </div>
  )
}
