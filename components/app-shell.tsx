'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import ThemePicker from '@/components/theme-picker'

const navigation: [string, string][] = [
  ['Dashboard', '/dashboard'],
  ['Purchases', '/purchases'],
  ['Inventory', '/inventory'],
  ['Production', '/production'],
  ['Orders', '/orders'],
  ['Order Fulfilment', '/orders-partial'],
  ['Sales & Invoices', '/sales-invoices'],
  ['Payments', '/payments'],
  ['Reports', '/reports'],
  ['Masters & Settings', '/masters-settings'],
]

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/'
  const isAuthRoute = pathname === '/login' || pathname.startsWith('/auth')

  if (isAuthRoute) {
    return <div className="auth-shell">{children}</div>
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/dashboard" className="brand" aria-label="Mane Masala Business System home">
          <img src="/mane-masala-brand.svg" alt="Mane Masala Business System" className="brand-logo" />
        </Link>
        <nav aria-label="Main navigation">
          {navigation.map(([label, href]) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                className={active ? 'nav-item nav-item-active' : 'nav-item'}
                href={href}
                key={href}
                aria-current={active ? 'page' : undefined}
              >
                {label}
              </Link>
            )
          })}
        </nav>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <div className="topbar-brand">
            <img src="/mane-masala-brand.svg" alt="Mane Masala" className="topbar-logo" />
            <div>
              <div className="eyebrow">Mane Masala</div>
              <div className="page-title">Business Management System</div>
            </div>
          </div>
          <div className="topbar-actions">
            <ThemePicker />
            <Link href="/account" className="secondary-button">Account</Link>
            <div className="foundation-badge">Live database</div>
          </div>
        </header>
        {children}
      </main>
    </div>
  )
}
