'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Row = Record<string, unknown>
const PAGE_SIZES = [20, 50, 100]
const HIDDEN_COLUMNS = new Set(['id', 'created_at', 'updated_at', 'category_id', 'base_unit_id', 'purchase_unit_id', 'selling_unit_id', 'customer_id'])
const SEARCH_COLUMNS: Record<string, string[]> = {
  items: ['business_code', 'name', 'item_type', 'subcategory', 'product_family', 'notes'], suppliers: ['business_code', 'business_name', 'contact_person', 'supplier_type', 'phone', 'whatsapp', 'upi_id', 'gst_number', 'email', 'notes'], customers: ['business_code', 'name', 'customer_type', 'phone', 'whatsapp', 'email', 'gst_number', 'notes'],
  units: ['code', 'name', 'symbol'], categories: ['code', 'name'], sub_agents: ['business_code', 'name', 'phone', 'whatsapp', 'notes'], purchases: ['business_code', 'supplier_invoice_number', 'system_reference', 'purchase_source', 'financial_status', 'workflow_status', 'notes'], inventory_transactions: ['business_code', 'transaction_type', 'reference_type', 'notes'], v_inventory_current: ['business_code', 'name'], recipes: ['business_code', 'name', 'status', 'notes'], production_batches: ['business_code', 'status', 'wife_approval_status', 'notes'], orders: ['business_code', 'source', 'status', 'requests', 'notes'], sales: ['business_code', 'status', 'notes'], invoices: ['business_code', 'invoice_number', 'financial_year', 'status', 'notes'], supplier_payments: ['business_code', 'payment_method', 'upi_reference', 'notes'], customer_payments: ['business_code', 'payment_method', 'upi_reference', 'notes'], v_supplier_outstanding: ['business_code', 'business_name'], v_customer_outstanding: ['business_code', 'name'],
}
const DEFAULT_SORT: Record<string, string> = { items: 'business_code', units: 'code', categories: 'code', suppliers: 'business_name', customers: 'name', sub_agents: 'name', v_inventory_current: 'business_code', v_supplier_outstanding: 'business_name', v_customer_outstanding: 'name' }
function label(column: string) { return column.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) }
function displayValue(value: unknown) { if (value === null || value === undefined) return ''; if (typeof value === 'boolean') return value ? 'Yes' : 'No'; return String(value) }
function safeSearch(value: string) { return value.replace(/[%,()]/g, ' ').trim() }

async function enrichItemRows(rows: Row[]) {
  if (!rows.length) return rows
  const sb = createClient()
  const categoryIds = [...new Set(rows.map((row) => String(row.category_id || '')).filter(Boolean))]
  const unitIds = [...new Set(rows.flatMap((row) => ['base_unit_id', 'purchase_unit_id', 'selling_unit_id'].map((key) => String(row[key] || '')).filter(Boolean)))]
  const [{ data: categories }, { data: units }] = await Promise.all([
    categoryIds.length ? sb.from('categories').select('id,code,name').in('id', categoryIds) : Promise.resolve({ data: [] as Row[] }),
    unitIds.length ? sb.from('units').select('id,code,name,symbol').in('id', unitIds) : Promise.resolve({ data: [] as Row[] }),
  ])
  const categoryMap = new Map((categories ?? []).map((row) => [String(row.id), row]))
  const unitMap = new Map((units ?? []).map((row) => [String(row.id), row]))
  return rows.map((row) => {
    const category = categoryMap.get(String(row.category_id || ''))
    const base = unitMap.get(String(row.base_unit_id || ''))
    const purchase = unitMap.get(String(row.purchase_unit_id || ''))
    const selling = unitMap.get(String(row.selling_unit_id || ''))
    return { ...row, category: category ? `${String(category.code)} — ${String(category.name)}` : '', base_unit: base ? `${String(base.name)} (${String(base.symbol)})` : '', purchase_unit: purchase ? `${String(purchase.name)} (${String(purchase.symbol)})` : '', selling_unit: selling ? `${String(selling.name)} (${String(selling.symbol)})` : '' }
  })
}

export default function DataTable({ table, refreshToken = 0 }: { table: string; refreshToken?: number }) {
  const [rows, setRows] = useState<Row[]>([]), [total, setTotal] = useState(0), [page, setPage] = useState(1), [pageSize, setPageSize] = useState(20)
  const [search, setSearch] = useState(''), [sort, setSort] = useState(DEFAULT_SORT[table] ?? 'created_at'), [ascending, setAscending] = useState(Boolean(DEFAULT_SORT[table]))
  const [error, setError] = useState(''), [loading, setLoading] = useState(true)
  useEffect(() => { setPage(1); setSort(DEFAULT_SORT[table] ?? 'created_at'); setAscending(Boolean(DEFAULT_SORT[table])); setSearch('') }, [table])
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true); setError('')
      let query = createClient().from(table).select('*', { count: 'exact' }).order(sort, { ascending, nullsFirst: false }).range((page - 1) * pageSize, page * pageSize - 1)
      const term = safeSearch(search), fields = SEARCH_COLUMNS[table] ?? []
      if (term && fields.length) query = query.or(fields.map((field) => `${field}.ilike.%${term}%`).join(','))
      const { data, count, error: queryError } = await query
      if (cancelled) return
      if (queryError) { setError(queryError.message); setLoading(false); return }
      const enriched = table === 'items' ? await enrichItemRows((data ?? []) as Row[]) : (data ?? []) as Row[]
      if (cancelled) return
      setRows(enriched); setTotal(count ?? 0); setLoading(false)
    }
    void load(); return () => { cancelled = true }
  }, [table, page, pageSize, search, sort, ascending, refreshToken])
  const columns = useMemo(() => { const first = rows[0]; if (!first) return []; return Object.keys(first).filter((column) => !HIDDEN_COLUMNS.has(column) && !column.endsWith('_id') && !['created_by', 'approved_by', 'confirmed_by'].includes(column)) }, [rows])
  const totalPages = Math.max(1, Math.ceil(total / pageSize)), start = total ? (page - 1) * pageSize + 1 : 0, end = Math.min(page * pageSize, total)
  const chooseSort = (column: string) => { if (sort === column) setAscending((value) => !value); else { setSort(column); setAscending(true) }; setPage(1) }
  const changeSearch = (value: string) => { setSearch(value); setPage(1) }
  if (error) return <p className="form-status form-status-error">{error}</p>
  return <div className="data-table"><div className="table-toolbar"><input className="table-search" value={search} onChange={(event) => changeSearch(event.target.value)} placeholder="Search…" aria-label={`Search ${table}`} /><div className="table-toolbar-right"><span className="table-count">{total} record{total === 1 ? '' : 's'}</span><select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1) }} aria-label="Rows per page">{PAGE_SIZES.map((size) => <option key={size} value={size}>{size} per page</option>)}</select></div></div><div className="table-wrap"><table><thead><tr>{columns.map((column) => <th key={column}><button className="table-sort" type="button" onClick={() => chooseSort(column)}>{label(column)} {sort === column ? (ascending ? '↑' : '↓') : '↕'}</button></th>)}</tr></thead><tbody>{loading ? <tr><td colSpan={Math.max(columns.length, 1)} className="table-message">Loading…</td></tr> : !rows.length ? <tr><td colSpan={Math.max(columns.length, 1)} className="table-message">No records found.</td></tr> : rows.map((row, index) => <tr key={String(row.id ?? `${page}-${index}`)}>{columns.map((column) => <td key={column}>{displayValue(row[column])}</td>)}</tr>)}</tbody></table></div><div className="table-pagination"><span>Showing {start}–{end} of {total}</span><div><button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1}>Previous</button><span>Page {page} of {totalPages}</span><button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page >= totalPages}>Next</button></div></div></div>
}
