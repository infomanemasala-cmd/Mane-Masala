'use client'
import { useState, type ReactNode } from 'react'
import DataTable from '@/components/data-table'

type Report = { key: string; title: string; tables: { title: string; table: string }[] }
const reports: Report[] = [
  { key: 'management', title: 'Management Summary', tables: [{ title: 'Money to Receive', table: 'v_customer_outstanding' }, { title: 'Money to Pay', table: 'v_supplier_outstanding' }, { title: 'Current Stock', table: 'v_inventory_current' }] },
  { key: 'sales', title: 'Sales', tables: [{ title: 'Sales', table: 'sales' }, { title: 'Invoices', table: 'invoices' }, { title: 'Dispatches', table: 'dispatches' }] },
  { key: 'purchases', title: 'Purchases', tables: [{ title: 'Purchases', table: 'v_purchases_list' }, { title: 'Purchase Price / Line History', table: 'purchase_lines' }] },
  { key: 'inventory', title: 'Inventory', tables: [{ title: 'Current Stock', table: 'v_inventory_current' }, { title: 'Inventory Movements / FIFO', table: 'inventory_transactions' }, { title: 'Stock Outs', table: 'stock_outs' }, { title: 'Stock Adjustments', table: 'stock_adjustments' }] },
  { key: 'production', title: 'Production', tables: [{ title: 'Production Batches', table: 'v_production_batches_list' }, { title: 'Order Production Plan', table: 'v_order_production_plan' }, { title: 'Production Consumption', table: 'production_consumption' }] },
  { key: 'customers', title: 'Customers', tables: [{ title: 'Customer Outstanding', table: 'v_customer_outstanding' }, { title: 'Customer Payments', table: 'customer_payments' }, { title: 'Sales', table: 'sales' }] },
  { key: 'suppliers', title: 'Suppliers', tables: [{ title: 'Supplier Outstanding', table: 'v_supplier_outstanding' }, { title: 'Supplier Payments', table: 'supplier_payments' }, { title: 'Purchases', table: 'v_purchases_list' }] },
  { key: 'payments', title: 'Payments', tables: [{ title: 'Customer Receipts', table: 'customer_payments' }, { title: 'Supplier Payments', table: 'supplier_payments' }, { title: 'Customer Advances', table: 'customer_advances' }, { title: 'Supplier Advances', table: 'supplier_advances' }] },
]
function Panel({ title, children }: { title: string; children: ReactNode }) { return <div className="console-panel"><div className="panel-heading"><h2>{title}</h2></div>{children}</div> }
export default function ReportConsole() {
  const [active, setActive] = useState('management')
  const report = reports.find(x => x.key === active) ?? reports[0]
  return <section className="page-panel"><div className="section-label">Mane Masala</div><div className="master-header"><div><h1>Reports</h1><p className="page-intro">Read-only business reports. Every table uses the same search, pagination and sortable-header standard.</p></div></div><div className="master-tabs">{reports.map(r => <button key={r.key} className={active === r.key ? 'tab-active' : ''} onClick={() => setActive(r.key)}>{r.title}</button>)}</div><div className="console-grid">{report.tables.map(t => <Panel key={`${report.key}-${t.table}`} title={t.title}><DataTable table={t.table}/></Panel>)}</div></section>
}
