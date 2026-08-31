import { createClient } from '@/lib/supabase/server'
import { StocktakeDetail } from '@/components/inventory/StocktakeDetail'

export default async function StocktakeDetailPage({ params }: PageProps<'/dashboard/inventory/stocktake/[id]'>) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  const { data: profile } = await supabase.from('users').select('role').eq('id', user!.id).single()

  return <StocktakeDetail stocktakeId={id} canManage={['outlet_manager', 'master_admin'].includes(profile?.role ?? '')} />
}
