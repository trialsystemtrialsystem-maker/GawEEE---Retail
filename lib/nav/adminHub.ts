// Single source of truth for the Master Admin control-center landing page
// (app/dashboard/admin/page.tsx). New admin pages get added here as they ship.

export interface AdminHubItem {
  href: string
  icon: string
  label: string
  description: string
}

export interface AdminHubSection {
  title: string
  items: AdminHubItem[]
}

export const ADMIN_HUB_SECTIONS: AdminHubSection[] = [
  {
    title: 'Organisasi',
    items: [
      { href: '/dashboard/admin/outlets', icon: '🏬', label: 'Outlets', description: 'Tambah, aktifkan/nonaktifkan, dan kelola data outlet.' },
      { href: '/dashboard/admin/users', icon: '👤', label: 'Users', description: 'Undang pengguna, atur peran, reset password.' },
      { href: '/dashboard/sales/outlet', icon: '📊', label: 'Performa Outlet', description: 'Leaderboard dan analisis penjualan per outlet.' },
    ],
  },
  {
    title: 'Pengaturan',
    items: [
      { href: '/dashboard/admin/system', icon: '🛠️', label: 'Pengaturan Sistem', description: 'Nama bisnis, NPWP, tarif PPN, dan teks struk.' },
      { href: '/dashboard/admin/master-data', icon: '🗄️', label: 'Data Master', description: 'Produk, kategori, pelanggan, supplier, akun, dan data referensi lainnya.' },
      { href: '/dashboard/admin/features', icon: '🧩', label: 'Menu & Fitur', description: 'Aktifkan atau sembunyikan modul sesuai kebutuhan bisnis.' },
      { href: '/dashboard/settings', icon: '⚙️', label: 'Info Outlet', description: 'Nama, alamat, target penjualan, dan lokasi absensi.' },
      { href: '/dashboard/settings/payment-methods', icon: '💳', label: 'Metode Pembayaran', description: 'Aktifkan atau nonaktifkan metode pembayaran per outlet.' },
      { href: '/dashboard/staff/reports', icon: '🧾', label: 'Riwayat Karyawan', description: 'Ringkasan kehadiran, cuti, insentif, kasbon, dan gaji per karyawan.' },
      { href: '/dashboard/staff/access', icon: '🔐', label: 'Hak Akses', description: 'Lihat peran dan izin yang berlaku di sistem.' },
    ],
  },
  {
    title: 'Operasional & Audit',
    items: [
      { href: '/dashboard/admin/bulk-operations', icon: '🧰', label: 'Bulk Operations', description: 'Ubah banyak data sekaligus.' },
      { href: '/dashboard/admin/audit-log', icon: '📜', label: 'Audit Log', description: 'Riwayat perubahan penting di sistem.' },
    ],
  },
]

// Master Admin > Data Master (todo.md Phase 32 batch 5): one place to reach
// every screen that manages reference data. Links only — the screens exist.
export const MASTER_DATA_SECTIONS: AdminHubSection[] = [
  {
    title: 'Produk & Katalog',
    items: [
      { href: '/dashboard/sales/product/departments', icon: '🗂️', label: 'Departemen', description: 'Kelompok besar produk.' },
      { href: '/dashboard/inventory/products', icon: '🏷️', label: 'Kategori', description: 'Kategori produk.' },
      { href: '/dashboard/inventory', icon: '📦', label: 'Produk & Bahan', description: 'Daftar produk, bahan, dan stok.' },
      { href: '/dashboard/sales/product/master-recipes', icon: '🍳', label: 'Master Resep', description: 'Resep dan komposisi bahan.' },
      { href: '/dashboard/sales/product/bundling', icon: '🎁', label: 'Bundling', description: 'Paket produk.' },
      { href: '/dashboard/sales/product/extra', icon: '➕', label: 'Extra Produk', description: 'Tambahan/topping.' },
      { href: '/dashboard/sales/product/notes-category', icon: '📝', label: 'Kategori Catatan', description: 'Catatan pesanan yang bisa dipilih.' },
    ],
  },
  {
    title: 'Pelanggan & Pemasok',
    items: [
      { href: '/dashboard/sales/customers/groups', icon: '👥', label: 'Grup Pelanggan', description: 'Kelompok pelanggan.' },
      { href: '/dashboard/sales/customers/special-pricing', icon: '💲', label: 'Harga Khusus', description: 'Grup harga khusus pelanggan.' },
      { href: '/dashboard/sales/customers/custom-fields', icon: '🧩', label: 'Kolom Kustom Pelanggan', description: 'Tambah kolom data pelanggan sendiri.' },
      { href: '/dashboard/suppliers', icon: '🚚', label: 'Supplier', description: 'Daftar dan data supplier.' },
    ],
  },
  {
    title: 'Keuangan & Operasional',
    items: [
      { href: '/dashboard/accounting/accounts', icon: '📒', label: 'Chart of Accounts', description: 'Daftar akun untuk jurnal dan laporan.' },
      { href: '/dashboard/settings/payment-methods', icon: '💳', label: 'Metode Pembayaran', description: 'Aktif/nonaktif per outlet.' },
      { href: '/dashboard/admin/outlets', icon: '🏬', label: 'Outlet', description: 'Data outlet.' },
      { href: '/dashboard/staff/schedule', icon: '🗓️', label: 'Shift & Jadwal', description: 'Shift kerja dan jadwal karyawan.' },
      { href: '/dashboard/staff/incentives', icon: '🎯', label: 'Aturan Insentif', description: 'Aturan insentif harian per outlet.' },
    ],
  },
]
