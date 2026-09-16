import BusinessConsole from '@/components/business-console'
import PaymentReconciliationCard from '@/components/payment-reconciliation-card'
import UrgentProcurementCard from '@/components/urgent-procurement-card'
export default function DashboardPage(){return <><BusinessConsole module="dashboard"/><section className="page-panel"><UrgentProcurementCard/></section><section className="page-panel"><PaymentReconciliationCard/></section></>}
