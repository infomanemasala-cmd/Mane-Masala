import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'
import './phase4e.css'
import './phase4f.css'
import './phase4g.css'
import ThemePicker from '@/components/theme-picker'

export const metadata: Metadata = { title:'Mane Masala Business System', description:'Business management system for Mane Masala' }
const navigation=[['Dashboard','/dashboard'],['Purchases','/purchases'],['Inventory','/inventory'],['Production','/production'],['Orders','/orders'],['Sales & Invoices','/sales-invoices'],['Payments','/payments'],['Reports','/reports'],['Masters & Settings','/masters-settings']]

export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><div className="app-shell"><aside className="sidebar"><Link href="/dashboard" className="brand" aria-label="Mane Masala Business System home"><img src="/mane-masala-brand.svg" alt="Mane Masala Business System" className="brand-logo"/></Link><nav aria-label="Main navigation">{navigation.map(([label,href])=><Link className="nav-item" href={href} key={href}>{label}</Link>)}</nav></aside><main className="main-content"><header className="topbar"><div className="topbar-brand"><img src="/mane-masala-brand.svg" alt="Mane Masala" className="topbar-logo"/><div><div className="eyebrow">Mane Masala</div><div className="page-title">Business Management System</div></div></div><div className="topbar-actions"><ThemePicker/><div className="foundation-badge">Live database</div></div></header>{children}</main></div></body></html>}
