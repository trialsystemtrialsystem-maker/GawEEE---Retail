'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/pos', label: 'Kasir', icon: '🛒' },
  { href: '/pos/riwayat', label: 'Riwayat Kasir', icon: '🧾' },
  { href: '/pos/laporan', label: 'Laporan Harian', icon: '📊' },
  { href: '/pos/absensi', label: 'Absensi', icon: '🕒' },
  { href: '/pos/checklist', label: 'Checklist', icon: '✅' },
  { href: '/pos/izin', label: 'Izin', icon: '📝' },
]

export function PosPortalNav() {
  const pathname = usePathname()

  return (
    <nav className="flex gap-1 overflow-x-auto px-2 sm:px-4">
      {TABS.map((tab) => {
        const active = tab.href === '/pos' ? pathname === '/pos' : pathname.startsWith(tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex shrink-0 items-center gap-1.5 rounded-t-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              active ? 'bg-[var(--background)] text-[var(--brand-900)]' : 'text-white/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            <span aria-hidden>{tab.icon}</span>
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
