// Shared navigation config, split into a top bar (5 primary modules, per the
// reference mockup) + a "More" set for everything else. The sidebar reads
// the same data and shows whichever section's children match the current
// route, instead of a flat always-expanded list.

export interface NavChild {
  label: string
  href: string
}

export interface NavGroup {
  label: string
  icon: string
  items: NavChild[]
}

export interface NavItem {
  key: string
  label: string
  href: string
  icon: string
  children?: NavChild[]
  /** Nested accordion groups, used by Sales/Inventory (majoo-style mockups)
   * — every other section keeps the flat `children` list. */
  groups?: NavGroup[]
  /** Flat links rendered *after* the groups (e.g. Inventory's "Supplier
   * List", which sits below the accordion in the reference mockup). */
  trailingChildren?: NavChild[]
}

export const PRIMARY_NAV: NavItem[] = [
  {
    key: 'sales',
    label: 'Sales',
    href: '/dashboard',
    icon: '📊',
    children: [
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Outlet', href: '/dashboard/sales/outlet' },
      { label: 'Laporan Harian', href: '/dashboard/reports/daily' },
    ],
    groups: [
      {
        label: 'Report',
        icon: '📋',
        items: [
          { label: 'Sales Report', href: '/dashboard/sales' },
          { label: 'Target vs Aktual', href: '/dashboard/sales/reports/target-vs-actual' },
          { label: 'Kitchen Report', href: '/dashboard/sales/reports/kitchen' },
          { label: 'Product Report', href: '/dashboard/sales/reports/product' },
          { label: 'Service Report', href: '/dashboard/sales/reports/service' },
          { label: 'Facility Report', href: '/dashboard/sales/reports/facility' },
          { label: 'Promo & Loyalty Report', href: '/dashboard/sales/reports/promo-loyalty' },
          { label: 'Tax Report', href: '/dashboard/financial/tax-report' },
          { label: 'Cashier Report', href: '/dashboard/sales/reports/cashier' },
          { label: 'Deposit Report', href: '/dashboard/sales/reports/deposit' },
          { label: 'Customer Summary Report', href: '/dashboard/sales/reports/customer-summary' },
          { label: 'Employee Report', href: '/dashboard/sales/reports/employee' },
          { label: 'Inventory Report', href: '/dashboard/sales/reports/inventory' },
          { label: 'Settlement Report', href: '/dashboard/sales/reports/settlement' },
        ],
      },
      {
        label: 'Report Analysis',
        icon: '📈',
        items: [
          { label: 'Product Peak Time', href: '/dashboard/sales/analysis/product-peak-time' },
          { label: 'Sales Peak Time', href: '/dashboard/sales/analysis/sales-peak-time' },
          { label: 'Stock Turnover', href: '/dashboard/sales/analysis/stock-turnover' },
          { label: 'Customer Satisfaction', href: '/dashboard/sales/analysis/customer-satisfaction' },
          { label: 'Segmentasi Pelanggan (RFM)', href: '/dashboard/sales/analysis/customer-segmentation' },
          { label: 'Analisis ABC Produk', href: '/dashboard/sales/analysis/abc-product' },
          { label: 'Market Basket', href: '/dashboard/sales/analysis/market-basket' },
          { label: 'Pelanggan Baru vs Lama', href: '/dashboard/sales/analysis/new-vs-returning' },
          { label: 'Analisis Pembatalan', href: '/dashboard/sales/analysis/void-analysis' },
        ],
      },
      {
        label: 'Product',
        icon: '📦',
        items: [
          { label: 'Department List', href: '/dashboard/sales/product/departments' },
          { label: 'Category List', href: '/dashboard/inventory/products' },
          { label: 'Product List', href: '/dashboard/inventory' },
          { label: 'Service Products', href: '/dashboard/sales/product/service-products' },
          { label: 'Product Facility', href: '/dashboard/sales/product/facility' },
          { label: 'Extra Product', href: '/dashboard/sales/product/extra' },
          { label: 'Product Bundling', href: '/dashboard/sales/product/bundling' },
          { label: 'Deposits', href: '/dashboard/sales/product/deposits' },
          { label: 'Scheduling Recipe Changes', href: '/dashboard/sales/product/recipe-changes' },
          { label: 'Ojek Online Price List', href: '/dashboard/sales/product/ojol-price-list' },
          { label: 'Price Scheduler', href: '/dashboard/sales/product/price-scheduler' },
          { label: 'Time-Based Pricing', href: '/dashboard/sales/product/time-based-pricing' },
          { label: 'Print Barcode', href: '/dashboard/sales/product/print-barcode' },
          { label: 'Notes Category List', href: '/dashboard/sales/product/notes-category' },
          { label: 'Master Recipes', href: '/dashboard/sales/product/master-recipes' },
        ],
      },
      {
        label: 'Customer',
        icon: '👨‍👩‍👧',
        items: [
          { label: 'Customer List', href: '/dashboard/sales/customers' },
          { label: 'Customer Group', href: '/dashboard/sales/customers/groups' },
          { label: 'Special Pricing Group', href: '/dashboard/sales/customers/special-pricing' },
          { label: 'Customer Custom Fields', href: '/dashboard/sales/customers/custom-fields' },
          { label: 'Customer Data Setting', href: '/dashboard/sales/customers/settings' },
        ],
      },
      {
        label: 'Promotion',
        icon: '🏷️',
        items: [
          { label: 'Promotion', href: '/dashboard/sales/promotion' },
          { label: 'Coupon', href: '/dashboard/sales/promotion/coupon' },
          { label: 'Loyalty', href: '/dashboard/sales/promotion/loyalty' },
          { label: 'Point Reward', href: '/dashboard/sales/promotion/point-reward' },
        ],
      },
      {
        label: 'Commission',
        icon: '🤝',
        items: [{ label: 'Commission Group List', href: '/dashboard/sales/commission' }],
      },
      {
        label: 'Invoice',
        icon: '🧾',
        items: [
          { label: 'Sales Quotation List', href: '/dashboard/sales/documents/quotations' },
          { label: 'Sales Order List', href: '/dashboard/sales/documents/orders' },
          { label: 'Sales Delivery List', href: '/dashboard/sales/documents/deliveries' },
          { label: 'Invoice List', href: '/dashboard/sales/invoices' },
          { label: 'Sales Receipt', href: '/dashboard/sales/invoices' },
        ],
      },
      {
        label: 'Campaign',
        icon: '📣',
        items: [
          { label: 'Send Marketing Campaign', href: '/dashboard/sales/campaign/send' },
          { label: 'Buy Marketing Campaign', href: '/dashboard/sales/campaign/buy' },
        ],
      },
    ],
  },
  {
    key: 'inventory',
    label: 'Inventory',
    href: '/dashboard/inventory',
    icon: '📦',
    children: [{ label: 'Ingredient List', href: '/dashboard/inventory' }],
    groups: [
      {
        label: 'Purchase Order (PO)',
        icon: '🧾',
        items: [
          { label: 'Item Request', href: '/dashboard/inventory/purchasing/item-request' },
          { label: 'Purchase Order (PO)', href: '/dashboard/suppliers/purchase-orders' },
          { label: 'Purchase Delivery', href: '/dashboard/inventory/purchasing/delivery' },
          { label: 'Purchase Invoice', href: '/dashboard/suppliers/invoices' },
          { label: 'Invoice Payment', href: '/dashboard/inventory/purchasing/invoice-payment' },
        ],
      },
      {
        label: 'Return',
        icon: '↩️',
        items: [
          { label: 'Purchase Return', href: '/dashboard/inventory/returns' },
          { label: 'Purchase Return Reconciliation', href: '/dashboard/inventory/returns/reconciliation' },
        ],
      },
      {
        label: 'Manage Stock',
        icon: '📦',
        items: [
          { label: 'Stock List', href: '/dashboard/inventory' },
          { label: 'Kartu Stok', href: '/dashboard/inventory/stock-card' },
          { label: 'Rekomendasi Pemesanan', href: '/dashboard/inventory/reorder' },
          { label: 'Nilai Persediaan', href: '/dashboard/inventory/valuation' },
          { label: 'Stok Semua Outlet', href: '/dashboard/inventory/overview' },
          { label: 'Stock Opname', href: '/dashboard/inventory/stocktake' },
          { label: 'Stock Waste', href: '/dashboard/inventory/stock/waste' },
          { label: 'Laporan Kadaluarsa', href: '/dashboard/inventory/expiry' },
        ],
      },
      {
        label: 'Stock Production',
        icon: '🏭',
        items: [
          { label: 'Stock Production List', href: '/dashboard/inventory/production' },
          { label: 'Stock Production Template', href: '/dashboard/inventory/production/template' },
        ],
      },
      {
        label: 'Stock Mutation',
        icon: '🔀',
        items: [
          { label: 'Stock Request', href: '/dashboard/inventory/mutation/request' },
          { label: 'Stock Must Sent', href: '/dashboard/inventory/mutation/must-sent' },
          { label: 'Stock Transfer', href: '/dashboard/inventory/mutation/transfer' },
          { label: 'Receive Stock Transfer', href: '/dashboard/inventory/mutation/receive-transfer' },
          { label: 'Stock in Transit', href: '/dashboard/inventory/mutation/in-transit' },
        ],
      },
    ],
    trailingChildren: [{ label: 'Supplier List', href: '/dashboard/suppliers' }],
  },
  {
    key: 'employee',
    label: 'Employee',
    href: '/dashboard/staff',
    icon: '👥',
    children: [
      { label: 'Daftar Karyawan', href: '/dashboard/staff' },
      { label: 'Attendance', href: '/dashboard/staff/attendance' },
      { label: 'Buka/Tutup Kasir', href: '/dashboard/staff/cashier-shifts' },
      { label: 'Payroll', href: '/dashboard/staff/payroll' },
      { label: 'Insentif Harian', href: '/dashboard/staff/incentives' },
      { label: 'Riwayat Karyawan', href: '/dashboard/staff/reports' },
      { label: 'Hak Akses', href: '/dashboard/staff/access' },
      { label: 'Jadwal Kerja', href: '/dashboard/staff/schedule' },
      { label: 'Notifikasi', href: '/dashboard/staff/notifications' },
      { label: 'Persetujuan Pembelian', href: '/dashboard/staff/approvals/purchasing' },
      { label: 'Persetujuan Keuangan', href: '/dashboard/staff/approvals/finance' },
      { label: 'Persetujuan Izin/Cuti', href: '/dashboard/staff/approvals/leave' },
    ],
  },
  {
    key: 'accounting',
    label: 'Accounting',
    href: '/dashboard/accounting',
    icon: '📒',
    children: [
      { label: 'Dashboard Akuntansi', href: '/dashboard/accounting' },
      { label: 'Jurnal Umum', href: '/dashboard/accounting/journal' },
      { label: 'Chart of Accounts', href: '/dashboard/accounting/accounts' },
      { label: 'Buku Besar', href: '/dashboard/accounting/ledger' },
      { label: 'Neraca Saldo', href: '/dashboard/accounting/trial-balance' },
      { label: 'Neraca', href: '/dashboard/accounting/balance-sheet' },
      { label: 'Laba Rugi', href: '/dashboard/accounting/profit-loss' },
      { label: 'Laporan Arus Kas', href: '/dashboard/accounting/cash-flow' },
      { label: 'Rasio Keuangan', href: '/dashboard/accounting/ratios' },
      { label: 'Piutang Usaha (AR)', href: '/dashboard/accounting/accounts-receivable' },
      { label: 'Hutang Usaha (AP)', href: '/dashboard/accounting/accounts-payable' },
      { label: 'Kas Kecil (Petty Cash)', href: '/dashboard/accounting/petty-cash' },
      { label: 'Aset Tetap', href: '/dashboard/accounting/fixed-assets' },
      { label: 'Anggaran', href: '/dashboard/accounting/budget' },
      { label: 'Tutup Buku', href: '/dashboard/accounting/periods' },
    ],
  },
  {
    key: 'admin',
    label: 'Master Admin',
    href: '/dashboard/admin',
    icon: '🏬',
    children: [
      { label: 'Pusat Kendali', href: '/dashboard/admin' },
      { label: 'Pengaturan Sistem', href: '/dashboard/admin/system' },
      { label: 'Menu & Fitur', href: '/dashboard/admin/features' },
      { label: 'Data Master', href: '/dashboard/admin/master-data' },
      { label: 'Outlets', href: '/dashboard/admin/outlets' },
      { label: 'Users', href: '/dashboard/admin/users' },
      { label: 'Bulk Operations', href: '/dashboard/admin/bulk-operations' },
      { label: 'Audit Log', href: '/dashboard/admin/audit-log' },
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
      { label: 'Cash Position', href: '/dashboard/financial/cash-position' },
      { label: 'Ringkasan Penjualan', href: '/dashboard/financial/reports' },
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

function childHrefsForItem(item: NavItem): string[] {
  const hrefs: string[] = []
  if (item.children) hrefs.push(...item.children.map((c) => c.href))
  if (item.groups) for (const g of item.groups) hrefs.push(...g.items.map((c) => c.href))
  if (item.trailingChildren) hrefs.push(...item.trailingChildren.map((c) => c.href))
  return hrefs
}

/** The nav item whose section the current pathname falls under, longest
 * `href` match first so e.g. `/dashboard/sales/invoices` doesn't get
 * shadowed by the `/dashboard` (Sales) item matching every dashboard route.
 *
 * First pass matches each item's own top-level `href` only (the original,
 * unchanged behavior — every existing page keeps resolving exactly as
 * before, e.g. Tax Report still resolves to "Keuangan" via its longer,
 * more specific top-level href beating Sales' bare `/dashboard`). Only when
 * the *best* top-level match is Sales' own bare `/dashboard` root — which
 * matches literally every `/dashboard/*` route and so isn't a real, specific
 * claim on this page — does a second pass check each item's
 * children/groups/trailingChildren hrefs instead, and prefer that if it
 * finds one. Needed for a page whose actual URL doesn't share its listing
 * menu's top-level href prefix (e.g. the accounting pages living at
 * /dashboard/accounting/* while listed under "Keuangan", whose own href is
 * /dashboard/financial — see todo.md Phase 31). Without this fallback,
 * Sidebar.tsx would render no submenu at all on those pages (it's driven
 * entirely by the matched item's children), not just a cosmetic
 * mis-highlight. */
export function findActiveNavItem(pathname: string): NavItem | undefined {
  const topMatches = ALL_NAV.filter((item) => pathname === item.href || pathname.startsWith(item.href + '/'))
  const bestTop =
    topMatches.length > 0 ? topMatches.reduce((longest, item) => (item.href.length > longest.href.length ? item : longest)) : undefined

  if (!bestTop || bestTop.href === '/dashboard') {
    let best: { item: NavItem; matchLength: number } | undefined
    for (const item of ALL_NAV) {
      for (const href of childHrefsForItem(item)) {
        if (pathname === href || pathname.startsWith(href + '/')) {
          if (!best || href.length > best.matchLength) best = { item, matchLength: href.length }
        }
      }
    }
    if (best) return best.item
  }

  return bestTop
}
