import { createClient } from '@/lib/supabase/server'
import { SupplierProfile } from '@/components/suppliers/SupplierProfile'

export default async function SupplierProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const { data: profile } = await supabase.from('users').select('role').eq('id', session!.user.id).single()

  return <SupplierProfile supplierId={id} canManage={['outlet_manager', 'master_admin'].includes(profile?.role ?? '')} />
}
