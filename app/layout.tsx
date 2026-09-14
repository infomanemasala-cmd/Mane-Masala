import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mane Masala Business System",
  description: "Business management system for Mane Masala",
};

const navigation = [
  "Dashboard",
  "Purchases",
  "Inventory",
  "Production",
  "Orders",
  "Sales & Invoices",
  "Payments",
  "Reports",
  "Masters & Settings",
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <aside className="sidebar">
            <div className="brand">
              <div className="brand-mark">MM</div>
              <div>
                <div className="brand-name">Mane Masala</div>
                <div className="brand-subtitle">Business System</div>
              </div>
            </div>

            <nav aria-label="Main navigation">
              {navigation.map((item, index) => (
                <div
                  className={`nav-item${index === 0 ? " nav-item-active" : ""}`}
                  key={item}
                >
                  {item}
                </div>
              ))}
            </nav>
          </aside>

          <main className="main-content">
            <header className="topbar">
              <div>
                <div className="eyebrow">Mane Masala</div>
                <div className="page-title">Business Management System</div>
              </div>
              <div className="foundation-badge">Foundation</div>
            </header>

            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
