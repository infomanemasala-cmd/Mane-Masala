export default function OrdersPage() {
  return (
    <section className="page-panel">
      <div className="section-label">Orders</div>
      <h1>Orders</h1>
      <p className="page-intro">
        Customer orders will move through confirmation, production planning,
        readiness and dispatch without reducing stock before physical dispatch.
      </p>
      <div className="empty-state">
        <strong>Order workflow</strong>
        <span>Order entry and status transitions will be connected next.</span>
      </div>
    </section>
  );
}
