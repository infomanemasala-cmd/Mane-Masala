export default function SalesInvoicesPage() {
  return (
    <section className="page-panel">
      <div className="section-label">Sales &amp; Invoices</div>
      <h1>Sales &amp; Invoices</h1>
      <p className="page-intro">
        Approved dispatches will feed sales, and invoices will be generated from
        approved sales without duplicate data entry.
      </p>
      <div className="empty-state">
        <strong>Dispatch → Sale → Invoice</strong>
        <span>The approved business flow will be implemented without double stock reduction.</span>
      </div>
    </section>
  );
}
