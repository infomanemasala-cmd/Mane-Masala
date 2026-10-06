'use client'

import { FormEvent, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import MasterItemManager from '@/components/master-item-manager'

type Row = Record<string, unknown>
type MasterTable = 'items' | 'suppliers' | 'customers' | 'units' | 'categories' | 'sub_agents'

const supplierTypes = [
  ['wholesaler', 'Wholesaler'],
  ['retailer', 'Retailer'],
  ['individual', 'Individual / Person'],
  ['farmer_producer', 'Farmer / Producer'],
  ['online_marketplace', 'Online marketplace'],
  ['manufacturer', 'Manufacturer'],
  ['other', 'Other'],
] as const

const customerTypes = [
  ['individual', 'Individual'],
  ['retail_shop', 'Retail shop'],
  ['restaurant', 'Restaurant'],
  ['caterer', 'Caterer'],
  ['online_customer', 'Online customer'],
  ['sub_agent', 'Sub-agent (identity only)'],
] as const

const titles: Record<MasterTable, string> = {
  items: 'Item',
  suppliers: 'Supplier',
  customers: 'Customer',
  units: 'Unit',
  categories: 'Category',
  sub_agents: 'Sub-agent',
}

const txt = (v: unknown) => String(v ?? '')

function Field({ label, children, required = false }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label className="form-field">
      <span>
        {label}
        {required ? ' *' : ''}
      </span>
      {children}
    </label>
  )
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-card purchase-modal">
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="secondary-button" type="button" onClick={onClose} aria-label="Close">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function MasterForm({
  table,
  editing = null,
  onSaved,
  onCancel,
}: {
  table: Exclude<MasterTable, 'items'>
  editing?: Row | null
  onSaved: (msg: string) => void
  onCancel: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [categories, setCategories] = useState<Row[]>([])
  const [subAgents, setSubAgents] = useState<Row[]>([])

  useEffect(() => {
    const sb = createClient()
    if (table === 'categories') {
      void sb.from('categories').select('id,name,code').eq('is_active', true).order('name').then(({ data }) => setCategories((data ?? []) as Row[]))
    }
    if (table === 'customers') {
      void sb
        .from('sub_agents')
        .select('id,name,business_code,is_active')
        .is('archived_at', null)
        .order('name')
        .then(({ data }) => setSubAgents((data ?? []) as Row[]))
    }
  }, [table])

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    const form = new FormData(event.currentTarget)
    const sb = createClient()

    try {
      if (table === 'units') {
        const payload = { name: String(form.get('name') || '').trim(), symbol: String(form.get('symbol') || '').trim() }
        const result = editing
          ? await sb.from('units').update(payload).eq('id', editing.id).select('*').single()
          : await sb.from('units').insert(payload).select('*').single()
        if (result.error) throw new Error(result.error.message)
        const code = txt((result.data as Row)?.code)
        onSaved(code ? `Saved successfully. Code: ${code}` : 'Saved successfully.')
        return
      }

      if (table === 'categories') {
        const payload = {
          name: String(form.get('name') || '').trim(),
          parent_category_id: String(form.get('parent_category_id') || '') || null,
        }
        const result = editing
          ? await sb.from('categories').update(payload).eq('id', editing.id).select('*').single()
          : await sb.from('categories').insert(payload).select('*').single()
        if (result.error) throw new Error(result.error.message)
        const code = txt((result.data as Row)?.code)
        onSaved(code ? `Saved successfully. Code: ${code}` : 'Saved successfully.')
        return
      }

      if (table === 'suppliers') {
        const payload = {
          business_name: String(form.get('business_name') || '').trim(),
          contact_person: String(form.get('contact_person') || '').trim() || null,
          supplier_type: String(form.get('supplier_type') || 'other'),
          phone: String(form.get('phone') || '').trim() || null,
          whatsapp: String(form.get('whatsapp') || '').trim() || null,
          order_call_number: String(form.get('order_call_number') || '').trim() || null,
          upi_id: String(form.get('upi_id') || '').trim() || null,
          gpay_phonepe: String(form.get('gpay_phonepe') || '').trim() || null,
          address: String(form.get('address') || '').trim() || null,
          gst_number: String(form.get('gst_number') || '').trim() || null,
          email: String(form.get('email') || '').trim() || null,
          preferred_payment_method: String(form.get('preferred_payment_method') || '').trim() || null,
          notes: String(form.get('notes') || '').trim() || null,
        }
        const result = editing
          ? await sb.from('suppliers').update(payload).eq('id', editing.id).select('*').single()
          : await sb.from('suppliers').insert(payload).select('*').single()
        if (result.error) throw new Error(result.error.message)
        const code = txt((result.data as Row)?.business_code)
        onSaved(code ? `Saved successfully. Code: ${code}` : 'Saved successfully.')
        return
      }

      if (table === 'customers') {
        const payload = {
          name: String(form.get('name') || '').trim(),
          customer_type: String(form.get('customer_type') || 'individual'),
          sub_agent_id: String(form.get('sub_agent_id') || '') || null,
          phone: String(form.get('phone') || '').trim() || null,
          whatsapp: String(form.get('whatsapp') || '').trim() || null,
          email: String(form.get('email') || '').trim() || null,
          address: String(form.get('address') || '').trim() || null,
          gst_number: String(form.get('gst_number') || '').trim() || null,
          notes: String(form.get('notes') || '').trim() || null,
        }
        const result = editing
          ? await sb.from('customers').update(payload).eq('id', editing.id).select('*').single()
          : await sb.from('customers').insert(payload).select('*').single()
        if (result.error) throw new Error(result.error.message)
        const code = txt((result.data as Row)?.business_code)
        onSaved(code ? `Saved successfully. Code: ${code}` : 'Saved successfully.')
        return
      }

      if (table === 'sub_agents') {
        const name = String(form.get('name') || '').trim()
        const phone = String(form.get('phone') || '').trim() || null
        const whatsapp = String(form.get('whatsapp') || '').trim() || null
        const address = String(form.get('address') || '').trim() || null
        const notes = String(form.get('notes') || '').trim() || null
        if (!name) throw new Error('Sub-agent name is required.')

        if (editing) {
          const result = await sb.from('sub_agents').update({ name, phone, whatsapp, address, notes }).eq('id', editing.id).select('*').single()
          if (result.error) throw new Error(result.error.message)
          const customerId = txt(editing.customer_id)
          if (customerId) await sb.from('customers').update({ name, phone, whatsapp, address }).eq('id', customerId)
          const code = txt((result.data as Row)?.business_code)
          onSaved(code ? `Saved successfully. Code: ${code}` : 'Saved successfully.')
          return
        }

        // Schema requires sub_agents.customer_id NOT NULL UNIQUE — create identity customer first.
        // End-customers under this Sub-Agent are assigned via Customer.sub_agent_id (many customers per agent).
        const { data: identity, error: identityError } = await sb
          .from('customers')
          .insert({ name, customer_type: 'sub_agent', phone, whatsapp, address, notes })
          .select('id')
          .single()
        if (identityError) throw new Error(identityError.message)

        const { data: sa, error: saError } = await sb
          .from('sub_agents')
          .insert({ customer_id: identity.id, name, phone, whatsapp, address, notes })
          .select('*')
          .single()
        if (saError) {
          await sb.from('customers').delete().eq('id', identity.id)
          throw new Error(saError.message)
        }
        const code = txt((sa as Row)?.business_code)
        onSaved(
          code
            ? `Sub-agent created. Code: ${code}. Assign customers from the Customer form.`
            : 'Sub-agent created. Assign customers from the Customer form.',
        )
        return
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.')
    } finally {
      setBusy(false)
    }
  }

  const activeSubAgents = subAgents.filter((sa) => sa.is_active !== false)

  return (
    <form className="console-form" onSubmit={save}>
      {table === 'units' && (
        <>
          <Field label="Name" required>
            <input name="name" required placeholder="Kilogram" defaultValue={txt(editing?.name)} />
          </Field>
          <Field label="Symbol" required>
            <input name="symbol" required placeholder="kg" defaultValue={txt(editing?.symbol)} />
          </Field>
        </>
      )}

      {table === 'categories' && (
        <>
          <Field label="Name" required>
            <input name="name" required defaultValue={txt(editing?.name)} />
          </Field>
          <Field label="Parent category">
            <select name="parent_category_id" defaultValue={txt(editing?.parent_category_id)}>
              <option value="">None</option>
              {categories.map((c) => (
                <option key={txt(c.id)} value={txt(c.id)}>
                  {txt(c.code)} — {txt(c.name)}
                </option>
              ))}
            </select>
          </Field>
        </>
      )}

      {table === 'suppliers' && (
        <>
          <Field label="Business name" required>
            <input name="business_name" required defaultValue={txt(editing?.business_name)} />
          </Field>
          <Field label="Contact person">
            <input name="contact_person" defaultValue={txt(editing?.contact_person)} />
          </Field>
          <Field label="Supplier type" required>
            <select name="supplier_type" defaultValue={txt(editing?.supplier_type || 'other')}>
              {supplierTypes.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Phone">
            <input name="phone" defaultValue={txt(editing?.phone)} />
          </Field>
          <Field label="WhatsApp">
            <input name="whatsapp" defaultValue={txt(editing?.whatsapp)} />
          </Field>
          <Field label="Order call number">
            <input name="order_call_number" defaultValue={txt(editing?.order_call_number)} />
          </Field>
          <Field label="UPI ID">
            <input name="upi_id" defaultValue={txt(editing?.upi_id)} />
          </Field>
          <Field label="GPay / PhonePe">
            <input name="gpay_phonepe" defaultValue={txt(editing?.gpay_phonepe)} />
          </Field>
          <Field label="Address">
            <input name="address" defaultValue={txt(editing?.address)} />
          </Field>
          <Field label="GST number">
            <input name="gst_number" defaultValue={txt(editing?.gst_number)} />
          </Field>
          <Field label="Email">
            <input name="email" type="email" defaultValue={txt(editing?.email)} />
          </Field>
          <Field label="Preferred payment method">
            <input name="preferred_payment_method" defaultValue={txt(editing?.preferred_payment_method)} />
          </Field>
          <Field label="Notes">
            <input name="notes" defaultValue={txt(editing?.notes)} />
          </Field>
        </>
      )}

      {table === 'customers' && (
        <>
          <Field label="Customer name" required>
            <input name="name" required placeholder="Customer name" defaultValue={txt(editing?.name)} />
          </Field>
          <Field label="Customer type" required>
            <select name="customer_type" defaultValue={txt(editing?.customer_type || 'individual')}>
              {customerTypes.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Sub-Agent assignment">
            <select name="sub_agent_id" defaultValue={txt(editing?.sub_agent_id)}>
              <option value="">Direct Customer (no Sub-Agent)</option>
              {subAgents
                .filter((sa) => sa.is_active || txt(sa.id) === txt(editing?.sub_agent_id))
                .map((sa) => (
                  <option key={txt(sa.id)} value={txt(sa.id)}>
                    {txt(sa.business_code)} — {txt(sa.name)}
                    {sa.is_active ? '' : ' (Inactive — retained)'}
                  </option>
                ))}
            </select>
            <p className="muted">
              {activeSubAgents.length === 0
                ? 'No active Sub-Agents yet. Create one under the Sub-agents tab, then assign customers here. One Sub-Agent can cover many customers.'
                : 'Direct = no Sub-Agent. Choose a Sub-Agent to route this customer through that agent. One Sub-Agent may have many customers.'}
            </p>
          </Field>
          <Field label="Phone">
            <input name="phone" defaultValue={txt(editing?.phone)} />
          </Field>
          <Field label="WhatsApp">
            <input name="whatsapp" defaultValue={txt(editing?.whatsapp)} />
          </Field>
          <Field label="Email">
            <input name="email" type="email" defaultValue={txt(editing?.email)} />
          </Field>
          <Field label="Address">
            <input name="address" defaultValue={txt(editing?.address)} />
          </Field>
          <Field label="GST number">
            <input name="gst_number" defaultValue={txt(editing?.gst_number)} />
          </Field>
          <Field label="Notes">
            <input name="notes" defaultValue={txt(editing?.notes)} />
          </Field>
        </>
      )}

      {table === 'sub_agents' && (
        <>
          <p className="muted" style={{ marginTop: 0 }}>
            Enter the Sub-Agent name and contact. Assign many end-customers later from Customer → Sub-Agent assignment.
          </p>
          <Field label="Sub-agent name" required>
            <input name="name" required defaultValue={txt(editing?.name)} placeholder="Sub-agent / agent name" />
          </Field>
          <Field label="Phone">
            <input name="phone" defaultValue={txt(editing?.phone)} />
          </Field>
          <Field label="WhatsApp">
            <input name="whatsapp" defaultValue={txt(editing?.whatsapp)} />
          </Field>
          <Field label="Address">
            <input name="address" defaultValue={txt(editing?.address)} />
          </Field>
          <Field label="Notes">
            <input name="notes" defaultValue={txt(editing?.notes)} />
          </Field>
        </>
      )}

      <div className="purchase-actions">
        <button className="secondary-button" type="button" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button className="primary-button" type="submit" disabled={busy}>
          {busy ? 'Saving…' : editing ? `Save ${titles[table]}` : `Create ${titles[table]}`}
        </button>
      </div>
      {error && (
        <p className="form-status form-status-error" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}

function MasterList({
  table,
  refreshToken,
  onEdit,
  banner,
}: {
  table: Exclude<MasterTable, 'items'>
  refreshToken: number
  onEdit: (row: Row) => void
  banner?: string
}) {
  const [rows, setRows] = useState<Row[]>([])
  const [view, setView] = useState<'active' | 'inactive' | 'archived'>('active')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const fields =
    table === 'suppliers'
      ? ['business_code', 'business_name', 'supplier_type', 'phone']
      : table === 'customers'
        ? ['business_code', 'name', 'customer_type', 'phone']
        : table === 'sub_agents'
          ? ['business_code', 'name', 'phone']
          : table === 'units'
            ? ['code', 'name', 'symbol']
            : ['code', 'name']

  const load = async () => {
    const sb = createClient()
    let q = sb.from(table).select('*')
    if (view === 'archived') q = q.not('archived_at', 'is', null)
    else {
      q = q.is('archived_at', null)
      if (view === 'active') q = q.eq('is_active', true)
      else q = q.eq('is_active', false)
    }
    const { data, error: e } = await q.order(table === 'suppliers' ? 'business_name' : 'name')
    if (e) setError(e.message)
    else setRows((data ?? []) as Row[])
  }

  useEffect(() => {
    void load()
  }, [table, view, refreshToken])

  useEffect(() => {
    if (banner) setMessage(banner)
  }, [banner, refreshToken])

  const filtered = rows.filter((r) => {
    if (!search.trim()) return true
    const s = search.toLowerCase()
    return fields.some((f) => txt(r[f]).toLowerCase().includes(s))
  })

  const archive = async () => {
    if (!selected.length) return
    setBusy(true)
    setMessage('')
    setError('')
    for (const id of selected) {
      const { error: e } = await createClient().rpc('archive_master_record', { p_table: table, p_id: id, p_reason: null })
      if (e) {
        setError(e.message)
        setBusy(false)
        return
      }
    }
    setSelected([])
    setBusy(false)
    setMessage('Archived successfully.')
    await load()
  }

  const restore = async (id: string) => {
    if (!window.confirm('Restore this record to the active list?')) return
    setBusy(true)
    setMessage('')
    setError('')
    const { error: e } = await createClient().rpc('restore_master_record', { p_table: table, p_id: id })
    setBusy(false)
    if (e) setError(e.message)
    else {
      setMessage('Restored successfully.')
      await load()
    }
  }

  const setActive = async (id: string, active: boolean) => {
    setBusy(true)
    setMessage('')
    setError('')
    const { error: e } = await createClient().from(table).update({ is_active: active }).eq('id', id)
    setBusy(false)
    if (e) setError(e.message)
    else {
      setMessage(active ? 'Set to Active.' : 'Set to Inactive.')
      await load()
    }
  }

  return (
    <div>
      <div className="master-tabs" role="tablist">
        <button type="button" className={view === 'active' ? 'tab-active' : ''} onClick={() => setView('active')}>
          Active
        </button>
        <button type="button" className={view === 'inactive' ? 'tab-active' : ''} onClick={() => setView('inactive')}>
          Inactive
        </button>
        <button type="button" className={view === 'archived' ? 'tab-active' : ''} onClick={() => setView('archived')}>
          Archived
        </button>
      </div>
      <div className="table-toolbar">
        <input className="table-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" aria-label="Search master records" />
        <span className="table-count">
          {filtered.length} record{filtered.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {view !== 'archived' && <th />}
              {fields.map((f) => (
                <th key={f}>{f.replaceAll('_', ' ')}</th>
              ))}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={txt(r.id)}>
                {view !== 'archived' && (
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.includes(txt(r.id))}
                      onChange={(e) =>
                        setSelected((v) => (e.target.checked ? [...new Set([...v, txt(r.id)])] : v.filter((x) => x !== txt(r.id))))
                      }
                    />
                  </td>
                )}
                {fields.map((f) => (
                  <td key={f}>{txt(r[f])}</td>
                ))}
                <td>
                  {view === 'archived' ? (
                    <button className="secondary-button" type="button" onClick={() => void restore(txt(r.id))} disabled={busy}>
                      Restore
                    </button>
                  ) : (
                    <>
                      <button className="secondary-button" type="button" onClick={() => onEdit(r)} disabled={busy}>
                        Edit
                      </button>
                      <button className="secondary-button" type="button" onClick={() => void setActive(txt(r.id), view !== 'active')} disabled={busy}>
                        {view === 'active' ? 'Set Inactive' : 'Set Active'}
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={fields.length + 2} className="table-message">
                  No records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {(message || banner) && (
        <p className="form-status form-status-success" role="status">
          {message || banner}
        </p>
      )}
      {error && (
        <p className="form-status form-status-error" role="alert">
          {error}
        </p>
      )}
      {view !== 'archived' && (
        <div className="purchase-actions">
          <button className="secondary-button" type="button" disabled={!selected.length || busy} onClick={() => void archive()}>
            Archive{selected.length ? ` (${selected.length})` : ''}
          </button>
        </div>
      )}
    </div>
  )
}

export default function MasterManager({
  table,
  requestedCreateType,
  onCreateRequestConsumed,
}: {
  table: MasterTable
  requestedCreateType?: string | null
  onCreateRequestConsumed?: () => void
}) {
  const [refreshToken, setRefreshToken] = useState(0)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)
  const [banner, setBanner] = useState('')

  if (table === 'items') {
    return <MasterItemManager requestedCreateType={requestedCreateType} onCreateRequestConsumed={onCreateRequestConsumed} />
  }

  const close = () => {
    setOpen(false)
    setEditing(null)
  }

  return (
    <div className="master-manager">
      <div className="master-header">
        <div>
          <h2>{titles[table]} Master</h2>
          <p>
            {table === 'sub_agents'
              ? 'Create Sub-Agents by name. Assign many customers to a Sub-Agent from the Customer form. Permanent codes come from the live database.'
              : 'Create, edit, activate, inactivate, archive and restore retained master records. Permanent codes are generated by the live database.'}
          </p>
        </div>
        <button className="primary-button" type="button" onClick={() => { setEditing(null); setOpen(true) }}>
          + Create {titles[table]}
        </button>
      </div>
      <MasterList table={table} refreshToken={refreshToken} banner={banner} onEdit={(row) => { setEditing(row); setOpen(true) }} />
      {open && (
        <ModalShell title={`${editing ? 'Edit' : 'Create'} ${titles[table]}`} onClose={close}>
          <MasterForm
            table={table}
            editing={editing}
            onCancel={close}
            onSaved={(msg) => {
              setBanner(msg)
              close()
              setRefreshToken((v) => v + 1)
            }}
          />
        </ModalShell>
      )}
    </div>
  )
}
