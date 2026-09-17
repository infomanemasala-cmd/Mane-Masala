'use client'

import DataTable from '@/components/data-table'

export default function PurchaseHistoryPanel() {
  return <div className="console-panel" style={{ marginTop: 18 }}>
    <div className="panel-heading">
      <div>
        <h2>Purchase history</h2>
        <span>Search, sort and open the permanent Purchase Code using the shared table.</span>
      </div>
    </div>
    <DataTable table="v_purchases_list" />
  </div>
}
