import { SelfAttendance } from '@/components/pos/SelfAttendance'

export default function AbsensiPage() {
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-xl font-extrabold text-[var(--brand-900)]">🕒 Absensi Harian</h1>
      <SelfAttendance />
    </div>
  )
}
