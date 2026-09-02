'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/pos', label: 'Kasir', icon: '🛒' },
  { href: '/pos/harga', label: 'Daftar Harga', icon: '🏷️' },
  { href: '/pos/riwayat', label: 'Riwayat Kasir', icon: '🧾' },
  { href: '/pos/laporan', label: 'Laporan Harian', icon: '📊' },
  { href: '/pos/absensi', label: 'Absensi', icon: '🕒' },
  { href: '/pos/checklist', label: 'Checklist', icon: '✅' },
  { href: '/pos/izin', label: 'Izin/Cuti', icon: '📝' },
]

export function PosPortalNav() {
  const pathname = usePathname()

  return (
    <nav className="flex gap-1.5 overflow-x-auto px-2 py-2 sm:px-6">
      {TABS.map((tab) => {
        const active = tab.href === '/pos' ? pathname === '/pos' : pathname.startsWith(tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
              active ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
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
