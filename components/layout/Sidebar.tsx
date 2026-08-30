'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavItem {
  label: string
  href: string
  icon: string
  children?: { label: string; href: string }[]
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Kasir (POS)',
    href: '/pos',
    icon: '🛒',
  },
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: '📊',
    children: [
      { label: 'Ringkasan', href: '/dashboard' },
      { label: 'Laporan Harian', href: '/dashboard/reports/daily' },
    ],
  },
  {
    label: 'Penjualan',
    href: '/dashboard/sales',
    icon: '💰',
    children: [
      { label: 'Transaksi', href: '/dashboard/sales' },
      { label: 'Invoice', href: '/dashboard/sales/invoices' },
    ],
  },
  {
    label: 'Inventori',
    href: '/dashboard/inventory',
    icon: '📦',
    children: [
      { label: 'Stok Barang', href: '/dashboard/inventory' },
      { label: 'Kategori Produk', href: '/dashboard/inventory/products' },
      { label: 'Stocktake', href: '/dashboard/inventory/stocktake' },
      { label: 'Stok Rendah', href: '/dashboard/inventory?status=low_stock' },
    ],
  },
  {
    label: 'Supplier',
    href: '/dashboard/suppliers',
    icon: '🏪',
    children: [
      { label: 'Daftar Supplier', href: '/dashboard/suppliers' },
      { label: 'Purchase Order', href: '/dashboard/suppliers/purchase-orders' },
      { label: 'Invoice Supplier', href: '/dashboard/suppliers/invoices' },
    ],
  },
  {
    label: 'Keuangan',
    href: '/dashboard/financial',
    icon: '📈',
    children: [
      { label: 'Laporan Harian', href: '/dashboard/financial' },
      { label: 'P&L Statement', href: '/dashboard/financial/reports' },
      { label: 'Cash Position', href: '/dashboard/financial/cash-position' },
      { label: 'Tax Report', href: '/dashboard/financial/tax-report' },
    ],
  },
  {
    label: 'Staff',
    href: '/dashboard/staff',
    icon: '👥',
    children: [
      { label: 'Daftar Karyawan', href: '/dashboard/staff' },
      { label: 'Attendance', href: '/dashboard/staff/attendance' },
    ],
  },
  {
    label: 'Order Online',
    href: '/dashboard/online-orders',
    icon: '🛵',
  },
  {
    label: 'Akuntansi',
    href: '/dashboard/accounting',
    icon: '📒',
    children: [
      { label: 'Dashboard Akuntansi', href: '/dashboard/accounting' },
      { label: 'Chart of Accounts', href: '/dashboard/accounting/accounts' },
      { label: 'Jurnal Umum', href: '/dashboard/accounting/journal' },
      { label: 'Buku Besar', href: '/dashboard/accounting/ledger' },
      { label: 'Neraca', href: '/dashboard/accounting/balance-sheet' },
      { label: 'Laba Rugi', href: '/dashboard/accounting/profit-loss' },
    ],
  },
  {
    label: 'WhatsApp',
    href: '/dashboard/whatsapp',
    icon: '💬',
  },
  {
    label: 'Master Admin',
    href: '/dashboard/admin',
    icon: '🏬',
    children: [
      { label: 'Outlets', href: '/dashboard/admin/outlets' },
      { label: 'Users', href: '/dashboard/admin/users' },
      { label: 'Bulk Operations', href: '/dashboard/admin/bulk-operations' },
      { label: 'Audit Log', href: '/dashboard/admin/audit-log' },
    ],
  },
  {
    label: 'Pengaturan',
    href: '/dashboard/settings',
    icon: '⚙️',
    children: [
      { label: 'Outlet Info', href: '/dashboard/settings' },
      { label: 'Metode Pembayaran', href: '/dashboard/settings/payment-methods' },
      { label: 'User Management', href: '/dashboard/settings/users' },
    ],
  },
]

export function Sidebar({ outletName, onNavigate }: { outletName?: string; onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Navigasi utama"
      className="flex h-full flex-col text-blue-100"
      style={{ background: 'linear-gradient(180deg, var(--brand-900), var(--brand-950))' }}
    >
      <div className="border-b border-white/10 px-4 py-4">
        <p className="text-lg font-bold text-white">GawEEE</p>
        {outletName && <p className="truncate text-xs text-blue-300">{outletName}</p>}
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <div key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-500 text-white shadow-sm shadow-blue-900/40'
                    : 'text-blue-200 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span aria-hidden>{item.icon}</span>
                {item.label}
              </Link>
              {isActive && item.children && (
                <div className="ml-8 mt-1 space-y-1 border-l border-white/10 pl-2">
                  {item.children.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={onNavigate}
                      className={`block rounded px-2 py-1 text-sm ${
                        pathname === child.href ? 'font-medium text-blue-300' : 'text-blue-200/70 hover:text-white'
                      }`}
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="border-t border-white/10 px-4 py-3">
        <a href="/dashboard/help" className="block text-sm text-blue-200 hover:text-white">
          ❓ Help &amp; Support
        </a>
      </div>
    </nav>
  )
}
