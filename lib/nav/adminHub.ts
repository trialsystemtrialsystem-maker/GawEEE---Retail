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
