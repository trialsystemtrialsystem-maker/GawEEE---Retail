import { createClient } from '@/lib/supabase/server'
import { Alert } from '@/components/ui/Alert'
import { CouponManager } from '@/components/sales/CouponManager'

export default async function CouponPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  const { data: profile } = await supabase.from('users').select('outlet_id, role').eq('id', user!.id).single()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Coupon</h1>
      {profile?.outlet_id ? (
        <CouponManager outletId={profile.outlet_id} canManage={['outlet_manager', 'master_admin'].includes(profile.role)} />
      ) : (
        <Alert variant="warning">Pilih outlet terlebih dahulu.</Alert>
      )}
    </div>
  )
}
