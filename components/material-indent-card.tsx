'use client'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type R = Record<string, any>
const s = (v: any) => String(v ?? '')
const n = (v: any) => Number(v ?? 0)

function downloadCsv(filename: string, rows: R[], headers: { key: string; label: string }[]) {
  const escape = (v: any) => {
    const t = String(v ?? '')
    if (/[",\n]/.test(t)) return `"${t.replace(/"/g, '""')}"`
    return t
  }
  const lines = [
    headers.map(h => h.label).join(','),
    ...rows.map(r => headers.map(h => escape(r[h.key])).join(',')),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Material Indent — consolidated vendor-ready list + line detail + Copy to Excel (CSV) */
export default function MaterialIndentCard() {
  const [rows, setRows] = useState<R[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'consolidated' | 'detail'>('consolidated')
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    const { data, error: e } = await createClient()
      .from('v_urgent_procurement')
      .select('*')
      .order('created_at', { ascending: true })
    if (e) setError(e.message)
    setRows(data ?? [])
    setLoading(false)
  }
  useEffect(() => { void load() }, [])

  const consolidated = useMemo(() => {
    const map = new Map<string, R>()
    for (const r of rows) {
      const key = `${s(r.ingredient_item_id || r.ingredient_code)}|${s(r.unit_symbol)}`
      const prev = map.get(key)
      const qty = n(r.qty_needed_immediately)
      if (!prev) {
        map.set(key, {
          ingredient_code: s(r.ingredient_code),
          ingredient_name: s(r.ingredient_name),
          unit_symbol: s(r.unit_symbol),
          total_qty: qty,
          order_count: 1,
          orders: [s(r.order_business_code)],
          priority: s(r.priority),
        })
      } else {
        prev.total_qty += qty
        prev.order_count += 1
        if (!prev.orders.includes(s(r.order_business_code))) prev.orders.push(s(r.order_business_code))
        if (s(r.priority) === 'urgent') prev.priority = 'urgent'
      }
    }
    return [...map.values()].sort((a, b) => b.total_qty - a.total_qty)
  }, [rows])

  const exportConsolidated = () => {
    downloadCsv(
      `Mane-Masala-Material-Indent-${new Date().toISOString().slice(0, 10)}.csv`,
      consolidated.map(r => ({
        ...r,
        orders: (r.orders as string[]).join('; '),
      })),
      [
        { key: 'ingredient_code', label: 'Item Code' },
        { key: 'ingredient_name', label: 'Item Name' },
        { key: 'unit_symbol', label: 'Unit' },
        { key: 'total_qty', label: 'Total Qty Needed' },
        { key: 'order_count', label: 'Order Count' },
        { key: 'orders', label: 'Order Codes' },
        { key: 'priority', label: 'Priority' },
      ],
    )
  }

  const exportDetail = () => {
    downloadCsv(
      `Mane-Masala-Material-Indent-Detail-${new Date().toISOString().slice(0, 10)}.csv`,
      rows.map(r => ({
        ingredient_code: s(r.ingredient_code),
        ingredient_name: s(r.ingredient_name),
        unit_symbol: s(r.unit_symbol),
        qty_needed_immediately: n(r.qty_needed_immediately),
        order_business_code: s(r.order_business_code),
        output_item_code: s(r.output_item_code),
        output_item_name: s(r.output_item_name),
        priority: s(r.priority),
      })),
      [
        { key: 'ingredient_code', label: 'Item Code' },
        { key: 'ingredient_name', label: 'Item Name' },
        { key: 'unit_symbol', label: 'Unit' },
        { key: 'qty_needed_immediately', label: 'Qty Needed' },
        { key: 'order_business_code', label: 'Order Code' },
        { key: 'output_item_code', label: 'Finished Item Code' },
        { key: 'output_item_name', label: 'Finished Item Name' },
        { key: 'priority', label: 'Priority' },
      ],
    )
  }

  return (
    <section className="console-panel">
      <div className="panel-heading">
        <div>
          <h2>Material Indent</h2>
          <span>
            Consolidated raw-material needs for orders waiting on purchase. Use Copy to Excel for the vendor list.
            After material is received, return to Orders for Wife approval and Confirm.
          </span>
        </div>
        <span className="status-pill">{rows.length} open</span>
      </div>
      <div className="table-toolbar" style={{ marginBottom: 12 }}>
        <div className="table-toolbar-right" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className={tab === 'consolidated' ? 'secondary-button tab-active' : 'secondary-button'} type="button" onClick={() => setTab('consolidated')}>
            Consolidated
          </button>
          <button className={tab === 'detail' ? 'secondary-button tab-active' : 'secondary-button'} type="button" onClick={() => setTab('detail')}>
            By order
          </button>
          <button className="secondary-button" type="button" onClick={() => void load()} disabled={loading}>
            Refresh
          </button>
          <button className="primary-button" type="button" disabled={loading || (tab === 'consolidated' ? consolidated.length === 0 : rows.length === 0)} onClick={tab === 'consolidated' ? exportConsolidated : exportDetail}>
            Copy to Excel
          </button>
          <a className="secondary-button" href="/purchases" style={{ display: 'inline-flex', alignItems: 'center' }}>Purchases</a>
          <a className="secondary-button" href="/orders" style={{ display: 'inline-flex', alignItems: 'center' }}>Orders</a>
        </div>
      </div>
      {error && <p className="form-status form-status-error">{error}</p>}
      {loading ? (
        <p className="table-message">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="table-message">No open material indent. When an order plan has ingredient shortfall, lines appear here until stock covers planned production.</p>
      ) : tab === 'consolidated' ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Total qty needed</th>
                <th>Orders</th>
                <th>Order codes</th>
                <th>Priority</th>
              </tr>
            </thead>
            <tbody>
              {consolidated.map((r, i) => (
                <tr key={`${s(r.ingredient_code)}-${i}`}>
                  <td>
                    <strong>{s(r.ingredient_code)}</strong>
                    <br />
                    {s(r.ingredient_name)}
                  </td>
                  <td className="num">
                    {n(r.total_qty).toFixed(3).replace(/\.?0+$/, '')} {s(r.unit_symbol)}
                  </td>
                  <td className="num">{r.order_count}</td>
                  <td>{(r.orders as string[]).join(', ')}</td>
                  <td>
                    <span className="status-pill">{s(r.priority)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty needed</th>
                <th>Against Order</th>
                <th>Finished Item</th>
                <th>Priority</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={s(r.id)}>
                  <td>
                    <strong>{s(r.ingredient_code)}</strong>
                    <br />
                    {s(r.ingredient_name)}
                  </td>
                  <td className="num">
                    {n(r.qty_needed_immediately)} {s(r.unit_symbol)}
                  </td>
                  <td>
                    <a className="table-link" href={`/transactions?table=orders&id=${encodeURIComponent(s(r.order_id))}`}>
                      {s(r.order_business_code)}
                    </a>
                  </td>
                  <td>
                    {s(r.output_item_code)} — {s(r.output_item_name)}
                  </td>
                  <td>
                    <span className="status-pill">{s(r.priority)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
