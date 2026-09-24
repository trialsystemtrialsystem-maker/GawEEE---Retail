import { createClient } from '@/lib/supabase/server'
import { ReorderManager } from '@/components/inventory/ReorderManager'

export default async function ReorderPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const { data: profile } = await supabase.from('users').select('role').eq('id', session!.user.id).single()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Rekomendasi Pemesanan</h1>
        <p className="text-gray-500">Barang yang perlu dipesan sekarang, dikelompokkan per supplier — satu klik menjadi PO draft.</p>
      </div>
      <ReorderManager canCreate={['outlet_manager', 'master_admin'].includes(profile?.role ?? '')} />
    </div>
  )
}
