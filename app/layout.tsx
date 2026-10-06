import type { Metadata } from 'next'
import './globals.css'
import './phase4e.css'
import './phase4f.css'
import './phase4g.css'
import './phase4h.css'
import AppShell from '@/components/app-shell'

export const metadata: Metadata = {
  title: 'Mane Masala Business System',
  description: 'Business management system for Mane Masala',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
