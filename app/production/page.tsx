export default function ProductionPage() {
  return (
    <section className="page-panel">
      <div className="section-label">Production</div>
      <h1>Production</h1>
      <p className="page-intro">
        Recipes, recipe versions, production batches, actual consumption and
        actual output will be managed here.
      </p>
      <div className="empty-state">
        <strong>Production workflow</strong>
        <span>Recipe and batch actions will be connected to inventory next.</span>
      </div>
    </section>
  );
}
