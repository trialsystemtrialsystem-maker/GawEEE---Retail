import { createClient } from '@/lib/supabase/server'
import { PurchaseOrderDetail } from '@/components/purchase-orders/PurchaseOrderDetail'

export default async function PurchaseOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const { data: profile } = await supabase.from('users').select('role').eq('id', session!.user.id).single()

  return <PurchaseOrderDetail poId={id} canManage={['outlet_manager', 'master_admin'].includes(profile?.role ?? '')} />
}
