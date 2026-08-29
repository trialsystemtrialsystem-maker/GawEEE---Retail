import { createClient } from '@/lib/supabase/server'
import { OutletPerformance } from '@/components/admin/OutletPerformance'
import { Alert } from '@/components/ui/Alert'

export default async function AdminOutletsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('role').eq('id', user!.id).single()

  if (profile?.role !== 'master_admin') {
    return <Alert variant="danger">Halaman ini khusus untuk Master Admin.</Alert>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Outlets</h1>
      <OutletPerformance />
    </div>
  )
}
