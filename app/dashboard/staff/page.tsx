import { createClient } from '@/lib/supabase/server'
import { StaffManager } from '@/components/staff/StaffManager'

export default async function StaffPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  const { data: profile } = await supabase.from('users').select('role').eq('id', user!.id).single()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Daftar Karyawan</h1>
        <p className="text-gray-500">Klik nama karyawan untuk melihat riwayat lengkapnya (absensi, cuti, ceklis, gaji, penjualan, dan lainnya).</p>
      </div>
      <StaffManager canManage={['outlet_manager', 'master_admin'].includes(profile?.role ?? '')} />
    </div>
  )
}
