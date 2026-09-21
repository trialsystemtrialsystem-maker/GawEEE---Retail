import { createClient } from '@/lib/supabase/server'
import { OutletPerformance } from '@/components/admin/OutletPerformance'
import { Alert } from '@/components/ui/Alert'

export default async function OutletIdentificationPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  const { data: profile } = await supabase.from('users').select('role').eq('id', user!.id).single()

  if (profile?.role !== 'master_admin') {
    return <Alert variant="danger">Halaman ini khusus untuk Master Admin.</Alert>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Identifikasi Outlet</h1>
        <p className="text-gray-500">Performa penjualan per outlet — klik salah satu outlet untuk melihat detailnya.</p>
      </div>
      <OutletPerformance />
    </div>
  )
}
