import { MyDailyReport } from '@/components/pos/MyDailyReport'

export default function LaporanHarianPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <h1 className="text-xl font-extrabold text-[var(--brand-900)]">📊 Laporan Harian Saya</h1>
      <MyDailyReport />
    </div>
  )
}
