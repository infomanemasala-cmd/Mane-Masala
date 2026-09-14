export default function ReportsPage() {
  return (
    <section className="page-panel">
      <div className="section-label">Reports</div>
      <h1>Reports</h1>
      <p className="page-intro">
        Sales, purchases, inventory, production, customer, supplier, payment and
        management reports will read from the same approved transaction data.
      </p>
      <div className="empty-state">
        <strong>Read-only reporting</strong>
        <span>Reports will be connected after the core transaction workflows are working.</span>
      </div>
    </section>
  );
}
