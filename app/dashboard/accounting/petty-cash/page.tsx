import { PettyCashReport } from '@/components/accounting/PettyCashReport'

export default function PettyCashPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Kas Kecil (Petty Cash)</h1>
        <p className="text-gray-500">Pengeluaran yang sudah disetujui dan dibayar — lihat/kelola persetujuan di Employee &gt; Approvals.</p>
      </div>
      <PettyCashReport />
    </div>
  )
}
