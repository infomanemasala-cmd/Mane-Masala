'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import DataTable from '@/components/data-table'
import MasterManager from '@/components/master-manager'
import ProductCatalogue from '@/components/product-catalogue'
import RecipeManager from '@/components/recipe-manager'

type Module = 'dashboard' | 'masters' | 'purchases' | 'inventory' | 'production' | 'orders' | 'sales' | 'payments' | 'reports'
const masterTables = ['items', 'suppliers', 'customers', 'units', 'categories', 'sub_agents', 'recipes'] as const

type Row = Record<string, unknown>

function Page({ title, children }: { title: string; children: ReactNode }) {
  return <section className="page-panel"><div className="section-label">Mane Masala</div><div className="master-header"><div><h1>{title}</h1></div></div>{children}</section>
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <div className="console-panel"><div className="panel-heading"><h2>{title}</h2></div>{children}</div>
}

function List({ title, table }: { title: string; table: string }) {
  return <Page title={title}><Panel title={title}><DataTable table={table} /></Panel></Page>
}

function Dual({ title, a, b, al, bl }: { title: string; a: string; b: string; al: string; bl: string }) {
  return <Page title={title}><div className="console-grid"><Panel title={al}><DataTable table={a} /></Panel><Panel title={bl}><DataTable table={b} /></Panel></div></Page>
}

function Masters() {
  const [table, setTable] = useState<(typeof masterTables)[number]>('items')
  return <Page title="Masters & Settings"><ProductCatalogue /><div className="master-tabs">{masterTables.map((name) => <button key={name} className={table === name ? 'tab-active' : ''} onClick={() => setTable(name)}>{name.replaceAll('_', ' ')}</button>)}</div>{table === 'recipes' ? <RecipeManager /> : <MasterManager table={table} />}</Page>
}

function Dashboard() {
  const [counts, setCounts] = useState<Record<string, number>>({})
  useEffect(() => {
    const sb = createClient()
    Promise.all(['items', 'suppliers', 'customers', 'purchases', 'orders'].map((table) => sb.from(table).select('*', { count: 'exact', head: true }))).then((results) => {
      setCounts(Object.fromEntries(['items', 'suppliers', 'customers', 'purchases', 'orders'].map((key, index) => [key, results[index].count ?? 0])))
    })
  }, [])
  return <Page title="Dashboard"><div className="dashboard-grid">{Object.entries(counts).map(([key, value]) => <div className="dashboard-card" key={key}><span>{key}</span><strong>{value}</strong><small>Live database count</small></div>)}</div></Page>
}

export default function BusinessConsole({ module }: { module: Module }) {
  if (module === 'dashboard') return <Dashboard />
  if (module === 'masters') return <Masters />
  if (module === 'purchases') return <List title="Purchases" table="v_purchases_list" />
  if (module === 'inventory') return <List title="Inventory" table="v_inventory_current" />
  if (module === 'production') return <List title="Production" table="v_production_batches_list" />
  if (module === 'orders') return <List title="Orders" table="v_orders_list" />
  if (module === 'sales') return <List title="Sales" table="sales" />
  if (module === 'payments') return <Dual title="Payments" a="supplier_payments" b="customer_payments" al="Supplier payments" bl="Customer payments" />
  if (module === 'reports') return <Dual title="Reports" a="v_supplier_outstanding" b="v_customer_outstanding" al="Supplier outstanding" bl="Customer outstanding" />
  return <Dashboard />
}

export type { Row }
