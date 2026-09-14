export default function HomePage() {
  return (
    <section className="welcome-panel">
      <div className="welcome-copy">
        <p className="section-label">Project foundation</p>
        <h1>Mane Masala Business System</h1>
        <p>
          The application foundation is ready. Business modules will be added
          only after the foundation, database, authentication, and safeguards
          are established and tested.
        </p>
      </div>

      <div className="foundation-list" aria-label="Foundation status">
        <div className="status-row">
          <span>Next.js + React + TypeScript</span>
          <strong>Ready</strong>
        </div>
        <div className="status-row">
          <span>Application shell</span>
          <strong>Ready</strong>
        </div>
        <div className="status-row">
          <span>Business modules</span>
          <strong>Not started</strong>
        </div>
      </div>
    </section>
  );
}
