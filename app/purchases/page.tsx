export default function PurchasesPage() {
  return (
    <section className="page-panel">
      <div className="section-label">Purchases</div>
      <h1>Purchases</h1>
      <p className="page-intro">
        Record supplier purchases, receiving, inspection and payment status.
        Physical accepted quantity remains separate from billed quantity.
      </p>
      <div className="empty-state">
        <strong>Purchase workflow</strong>
        <span>The transaction screens will be connected to Supabase next.</span>
      </div>
    </section>
  );
}
