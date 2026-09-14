export default function DashboardPage() {
  return (
    <section className="page-panel">
      <div className="section-label">Dashboard</div>
      <h1>Good morning</h1>
      <p className="page-intro">
        Mane Masala business activity will appear here as the application modules
        are connected to the approved database.
      </p>

      <div className="dashboard-grid">
        <div className="dashboard-card">
          <span>Stock</span>
          <strong>Ready for connection</strong>
          <small>Current, reserved and low-stock information.</small>
        </div>
        <div className="dashboard-card">
          <span>Money to receive</span>
          <strong>Ready for connection</strong>
          <small>Customer outstanding and payment activity.</small>
        </div>
        <div className="dashboard-card">
          <span>Money to pay</span>
          <strong>Ready for connection</strong>
          <small>Supplier outstanding and payment activity.</small>
        </div>
        <div className="dashboard-card">
          <span>Today's work</span>
          <strong>Ready for connection</strong>
          <small>Purchases, orders, production and dispatch.</small>
        </div>
      </div>
    </section>
  );
}
