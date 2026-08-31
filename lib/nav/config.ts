// Shared navigation config, split into a top bar (5 primary modules, per the
// reference mockup) + a "More" set for everything else. The sidebar reads
// the same data and shows whichever section's children match the current
// route, instead of a flat always-expanded list.

export interface NavChild {
  label: string
  href: string
}

export interface NavItem {
  key: string
  label: string
  href: string
  icon: string
  children?: NavChild[]
}

export const PRIMARY_NAV: NavItem[] = [
  {
    key: 'sales',
    label: 'Sales',
    href: '/dashboard',
    icon: '📊',
    children: [
      { label: 'Ringkasan', href: '/dashboard' },
      { label: 'Laporan Harian', href: '/dashboard/reports/daily' },
      { label: 'Transaksi', href: '/dashboard/sales' },
      { label: 'Invoice', href: '/dashboard/sales/invoices' },
    ],
  },
  {
    key: 'inventory',
    label: 'Inventory',
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
    key: 'employee',
    label: 'Employee',
    href: '/dashboard/staff',
    icon: '👥',
    children: [
      { label: 'Daftar Karyawan', href: '/dashboard/staff' },
      { label: 'Attendance', href: '/dashboard/staff/attendance' },
      { label: 'Payroll', href: '/dashboard/staff/payroll' },
      { label: 'Hak Akses', href: '/dashboard/staff/access' },
      { label: 'Jadwal Kerja', href: '/dashboard/staff/schedule' },
      { label: 'Notifikasi', href: '/dashboard/staff/notifications' },
      { label: 'Persetujuan Pembelian', href: '/dashboard/staff/approvals/purchasing' },
      { label: 'Persetujuan Keuangan', href: '/dashboard/staff/approvals/finance' },
    ],
  },
  {
    key: 'accounting',
    label: 'Accounting',
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
    key: 'whatsapp',
    label: 'WhatsApp',
    href: '/dashboard/whatsapp',
    icon: '💬',
  },
]

export const SECONDARY_NAV: NavItem[] = [
  {
    key: 'suppliers',
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
    key: 'financial',
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
    key: 'online-orders',
    label: 'Order Online',
    href: '/dashboard/online-orders',
    icon: '🛵',
  },
  {
    key: 'bookings',
    label: 'Booking',
    href: '/dashboard/bookings',
    icon: '📅',
  },
  {
    key: 'admin',
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
    key: 'settings',
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

export const ALL_NAV: NavItem[] = [...PRIMARY_NAV, ...SECONDARY_NAV]

/** The nav item whose section the current pathname falls under, longest
 * `href` match first so e.g. `/dashboard/sales/invoices` doesn't get
 * shadowed by the `/dashboard` (Sales) item matching every dashboard route. */
export function findActiveNavItem(pathname: string): NavItem | undefined {
  const matches = ALL_NAV.filter((item) => pathname === item.href || pathname.startsWith(item.href + '/'))
  if (matches.length === 0) return undefined
  return matches.reduce((longest, item) => (item.href.length > longest.href.length ? item : longest))
}
