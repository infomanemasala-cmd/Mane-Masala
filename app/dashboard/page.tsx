import BusinessConsole from '@/components/business-console'
import PaymentReconciliationCard from '@/components/payment-reconciliation-card'
import MaterialIndentCard from '@/components/material-indent-card'

export default function DashboardPage() {
  return (
    <>
      <BusinessConsole module="dashboard" />
      <section className="page-panel">
        <MaterialIndentCard />
      </section>
      <section className="page-panel">
        <PaymentReconciliationCard />
      </section>
    </>
  )
}
