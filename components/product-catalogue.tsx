'use client'

import { useState } from 'react'
import DataTable from '@/components/data-table'

type ProductTab = 'finished_product' | 'purchased_finished_product'

export default function ProductCatalogue() {
  const [tab, setTab] = useState<ProductTab>('finished_product')
  const title = tab === 'finished_product' ? 'Finished Products' : 'Purchased Finished Products'
  return <div className="console-panel" style={{ marginBottom: 18 }}>
    <div className="panel-heading">
      <div>
        <h2>Products for Sale</h2>
        <span>Sellable inventory is separated by the approved Finished Product and Purchased Finished Product item types.</span>
      </div>
    </div>
    <div className="master-tabs" role="tablist" aria-label="Products for sale">
      <button className={tab === 'finished_product' ? 'tab-active' : ''} onClick={() => setTab('finished_product')}>Finished Products</button>
      <button className={tab === 'purchased_finished_product' ? 'tab-active' : ''} onClick={() => setTab('purchased_finished_product')}>Purchased Finished Products</button>
    </div>
    <p className="page-intro" style={{ marginTop: 10 }}>{title} are read from the live Item Master. No duplicate product records are created merely because an item can be sold and used in production.</p>
    <DataTable table="items" filters={[{ column: 'item_type', operator: 'eq', value: tab }, { column: 'can_be_sold', operator: 'eq', value: true }, { column: 'is_active', operator: 'eq', value: true }]} />
  </div>
}
