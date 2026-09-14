export default function InventoryPage() {
  return (
    <section className="page-panel">
      <div className="section-label">Inventory</div>
      <h1>Inventory</h1>
      <p className="page-intro">
        Current stock, movements, reservations, FIFO batches and stock-outs will
        be shown from transaction history.
      </p>
      <div className="empty-state">
        <strong>Inventory foundation</strong>
        <span>Stock calculations will be connected to the approved transaction model.</span>
      </div>
    </section>
  );
}
