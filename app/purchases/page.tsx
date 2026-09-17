import PurchaseConsoleV3 from '@/components/purchase-console-v3'
import PurchaseHistoryPanel from '@/components/purchase-history-panel'

export default function PurchasesPage() {
  return <>
    <PurchaseConsoleV3 />
    <section className="page-panel" style={{ paddingTop: 0 }}>
      <PurchaseHistoryPanel />
    </section>
  </>
}
