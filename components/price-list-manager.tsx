'use client'

import { useEffect, useMemo, useState } from 'react'
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
  ['sub_agent', 'Sub-agent (identity only)'],
] as const

function Field({ label, children, help }: { label: string; children: React.ReactNode; help?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {help ? <small className="muted">{help}</small> : null}
    </label>
  )
}

export default function PriceListManager() {
  const [items, setItems] = useState<R[]>([])
  const [rows, setRows] = useState<R[]>([])
  const [filterItem, setFilterItem] = useState('')
  const [filterType, setFilterType] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<R | null>(null)

  const [itemId, setItemId] = useState('')
  const [customerType, setCustomerType] = useState('retail_shop')
  const [priceMode, setPriceMode] = useState<'fixed' | 'percent'>('fixed')
  const [unitPrice, setUnitPrice] = useState('')
  const [percent, setPercent] = useState('100')
  const [rateBasis, setRateBasis] = useState<'kg' | 'pack'>('kg')
  const [notes, setNotes] = useState('')
  const [isActive, setIsActive] = useState(true)

  const load = async () => {
    const x = db()
    const [i, p] = await Promise.all([
      x
        .from('items')
        .select('id,item_code,business_code,name,can_be_sold,is_active,default_selling_rate,selling_pack_size_kg,selling_pack_label')
        .eq('is_active', true)
        .eq('can_be_sold', true)
        .order('name'),
      x.from('item_customer_type_prices').select('*').order('customer_type'),
    ])
    if (i.error) {
      setError(true)
      setMessage(i.error.message)
      return
    }
    if (p.error) {
      setError(true)
      setMessage(p.error.message)
      return
    }
    setItems(i.data ?? [])
    setRows(p.data ?? [])
    setError(false)
    setMessage('')
  }

  useEffect(() => {
    void load()
  }, [])

  const itemMap = useMemo(() => {
    const m = new Map<string, R>()
    for (const it of items) m.set(s(it.id), it)
    return m
  }, [items])

  const typeLabel = (code: string) => CUSTOMER_TYPES.find(([v]) => v === code)?.[1] || code

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filterItem && s(r.item_id) !== filterItem) return false
      if (filterType && s(r.customer_type) !== filterType) return false
      return true
    })
  }, [rows, filterItem, filterType])

  const selectedItem = itemMap.get(itemId)
  const defaultRate = n(selectedItem?.default_selling_rate)
  const previewRate = useMemo(() => {
    if (priceMode === 'percent') {
      if (!defaultRate || !n(percent)) return null
      return +(defaultRate * (n(percent) / 100)).toFixed(4)
    }
    if (!n(unitPrice) && unitPrice !== '0') return null
    if (rateBasis === 'pack' && n(selectedItem?.selling_pack_size_kg) > 0) {
      return +(n(unitPrice) / n(selectedItem?.selling_pack_size_kg)).toFixed(4)
    }
    return n(unitPrice)
  }, [priceMode, percent, unitPrice, rateBasis, defaultRate, selectedItem])

  const resetForm = () => {
    setEditing(null)
    setItemId('')
    setCustomerType('retail_shop')
    setPriceMode('fixed')
    setUnitPrice('')
    setPercent('100')
    setRateBasis('kg')
    setNotes('')
    setIsActive(true)
  }

  const openCreate = () => {
    resetForm()
    setOpen(true)
    setMessage('')
    setError(false)
  }

  const openEdit = (r: R) => {
    setEditing(r)
    setItemId(s(r.item_id))
    setCustomerType(s(r.customer_type) || 'retail_shop')
    setPriceMode((s(r.price_mode) === 'percent' ? 'percent' : 'fixed') as 'fixed' | 'percent')
    setUnitPrice(r.unit_price != null ? String(r.unit_price) : '')
    setPercent(r.percent_of_default != null ? String(r.percent_of_default) : '100')
    setRateBasis((s(r.rate_basis) === 'pack' ? 'pack' : 'kg') as 'kg' | 'pack')
    setNotes(s(r.notes))
    setIsActive(r.is_active !== false)
    setOpen(true)
    setMessage('')
    setError(false)
  }

  const save = async () => {
    if (!itemId) {
      setError(true)
      setMessage('Select a product.')
      return
    }
    if (!customerType) {
      setError(true)
      setMessage('Select a customer type.')
      return
    }
    if (priceMode === 'fixed' && !(n(unitPrice) >= 0) && unitPrice !== '0') {
      setError(true)
      setMessage('Enter a fixed price (0 or more).')
      return
    }
    if (priceMode === 'percent' && !(n(percent) > 0)) {
      setError(true)
      setMessage('Enter a percent greater than 0 (e.g. 90 = 90% of default rate).')
      return
    }
    if (priceMode === 'percent' && !defaultRate) {
      setError(true)
      setMessage('This product has no default selling rate. Set default_selling_rate on Item Master first, or use Fixed price.')
      return
    }

    const payload = {
      item_id: itemId,
      customer_type: customerType,
      price_mode: priceMode,
      unit_price: priceMode === 'fixed' ? n(unitPrice) : null,
      percent_of_default: priceMode === 'percent' ? n(percent) : null,
      rate_basis: priceMode === 'fixed' ? rateBasis : 'kg',
      notes: notes.trim() || null,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    }

    setBusy(true)
    const x = db()
    let e: { message: string } | null = null
    if (editing) {
      const res = await x.from('item_customer_type_prices').update(payload).eq('id', editing.id)
      e = res.error
    } else {
      const res = await x.from('item_customer_type_prices').upsert(payload, { onConflict: 'item_id,customer_type' })
      e = res.error
    }
    setBusy(false)
    if (e) {
      setError(true)
      setMessage(e.message)
      return
    }
    setOpen(false)
    resetForm()
    setError(false)
    setMessage(editing ? 'Price list row updated.' : 'Price list row saved.')
    await load()
  }

  const remove = async (id: string) => {
    if (!window.confirm('Remove this price list row? Orders will fall back to the item default rate.')) return
    setBusy(true)
    const { error: e } = await db().from('item_customer_type_prices').delete().eq('id', id)
    setBusy(false)
    if (e) {
      setError(true)
      setMessage(e.message)
      return
    }
    setError(false)
    setMessage('Price list row removed.')
    await load()
  }

  const displayPrice = (r: R) => {
    const it = itemMap.get(s(r.item_id))
    const def = n(it?.default_selling_rate)
    if (s(r.price_mode) === 'percent') {
      const pct = n(r.percent_of_default)
      const computed = def ? +(def * (pct / 100)).toFixed(2) : null
      return `${pct}% of default${computed != null ? ` → ₹${computed}/kg` : ' (set default rate on item)'}`
    }
    const basis = s(r.rate_basis) === 'pack' ? '/pack' : '/kg'
    return `₹${n(r.unit_price)}${basis}`
  }

  return (
    <div className="console-panel">
      <div className="panel-heading">
        <div>
          <h2>Selling price list by customer type</h2>
          <span>
            Set a <strong>fixed price</strong> or a <strong>% of the item default rate</strong> for each product and customer type.
            Orders auto-fill rate from this list; you can still override on the order line.
          </span>
        </div>
        <button className="primary-button" type="button" onClick={openCreate}>
          + Add price
        </button>
      </div>

      <div className="form-grid" style={{ marginBottom: 12 }}>
        <Field label="Filter by product">
          <select value={filterItem} onChange={(e) => setFilterItem(e.target.value)}>
            <option value="">All products</option>
            {items.map((it) => (
              <option key={s(it.id)} value={s(it.id)}>
                {s(it.item_code || it.business_code)} — {s(it.name)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Filter by customer type">
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="">All types</option>
            {CUSTOMER_TYPES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Customer type</th>
              <th>Mode</th>
              <th>Price</th>
              <th>Default (item)</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const it = itemMap.get(s(r.item_id))
              return (
                <tr key={s(r.id)}>
                  <td>
                    {s(it?.item_code || it?.business_code)} — {s(it?.name) || s(r.item_id)}
                  </td>
                  <td>{typeLabel(s(r.customer_type))}</td>
                  <td>{s(r.price_mode) === 'percent' ? 'Percent' : 'Fixed'}</td>
                  <td>{displayPrice(r)}</td>
                  <td>{it?.default_selling_rate != null ? `₹${n(it.default_selling_rate)}/kg` : '—'}</td>
                  <td>{r.is_active === false ? 'Inactive' : 'Active'}</td>
                  <td>
                    <button className="secondary-button" type="button" disabled={busy} onClick={() => openEdit(r)}>
                      Edit
                    </button>{' '}
                    <button className="secondary-button" type="button" disabled={busy} onClick={() => void remove(s(r.id))}>
                      Remove
                    </button>
                  </td>
                </tr>
              )
            })}
            {!filtered.length && (
              <tr>
                <td colSpan={7} className="table-message">
                  No price list rows yet. Add a price for a product + customer type, or leave empty to use each item&apos;s default selling rate only.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {message && (
        <p className={`form-status${error ? ' form-status-error' : ''}`} role="alert">
          {message}
        </p>
      )}

      {open && (
        <div className="modal-backdrop">
          <div className="modal-card purchase-modal">
            <div className="modal-header">
              <h3>{editing ? 'Edit price list row' : 'Add price list row'}</h3>
              <button className="secondary-button" type="button" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
            <p className="muted">
              When an order is taken for a customer of this type, the rate auto-fills from this row. Priority: this list → item default rate → blank
              (manual entry).
            </p>
            <div className="form-grid">
              <Field label="Product">
                <select value={itemId} onChange={(e) => setItemId(e.target.value)} disabled={Boolean(editing)}>
                  <option value="">Select product</option>
                  {items.map((it) => (
                    <option key={s(it.id)} value={s(it.id)}>
                      {s(it.item_code || it.business_code)} — {s(it.name)}
                      {it.default_selling_rate != null ? ` (default ₹${n(it.default_selling_rate)}/kg)` : ''}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Customer type">
                <select value={customerType} onChange={(e) => setCustomerType(e.target.value)} disabled={Boolean(editing)}>
                  {CUSTOMER_TYPES.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Price mode" help="Fixed = exact amount. Percent = share of the item default rate (e.g. 90 = 10% discount).">
                <select value={priceMode} onChange={(e) => setPriceMode(e.target.value as 'fixed' | 'percent')}>
                  <option value="fixed">Fixed price</option>
                  <option value="percent">Percent of default rate</option>
                </select>
              </Field>
              {priceMode === 'fixed' ? (
                <>
                  <Field label="Rate basis" help="Pack only if the product has a pack size on Item Master.">
                    <select value={rateBasis} onChange={(e) => setRateBasis(e.target.value as 'kg' | 'pack')}>
                      <option value="kg">Per kg</option>
                      <option value="pack">Per pack</option>
                    </select>
                  </Field>
                  <Field label={rateBasis === 'pack' ? 'Price per pack (₹)' : 'Price per kg (₹)'}>
                    <input type="number" min="0" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
                  </Field>
                </>
              ) : (
                <Field label="Percent of default (%)" help="100 = same as default. 90 = 10% off. 110 = 10% premium.">
                  <input type="number" min="0.01" step="0.01" value={percent} onChange={(e) => setPercent(e.target.value)} />
                </Field>
              )}
              <Field label="Notes">
                <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
              </Field>
              <Field label="Active">
                <select value={isActive ? 'yes' : 'no'} onChange={(e) => setIsActive(e.target.value === 'yes')}>
                  <option value="yes">Active</option>
                  <option value="no">Inactive</option>
                </select>
              </Field>
            </div>
            {previewRate != null && (
              <p className="muted">
                Effective rate used on orders (per kg): <strong>₹{previewRate}</strong>
                {priceMode === 'percent' && defaultRate ? ` (from default ₹${defaultRate}/kg × ${n(percent)}%)` : ''}
              </p>
            )}
            <div className="purchase-actions">
              <button className="secondary-button" type="button" onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </button>
              <button className="primary-button" type="button" onClick={() => void save()} disabled={busy}>
                {busy ? 'Saving…' : editing ? 'Save changes' : 'Save price'}
              </button>
            </div>
            {message && open && (
              <p className={`form-status${error ? ' form-status-error' : ''}`} role="alert">
                {message}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
