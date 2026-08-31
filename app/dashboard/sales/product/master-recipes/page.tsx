import { createClient } from '@/lib/supabase/server'
import { Alert } from '@/components/ui/Alert'
import { RecipeManager } from '@/components/inventory/RecipeManager'

export default async function MasterRecipesPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  const { data: profile } = await supabase.from('users').select('outlet_id, role').eq('id', user!.id).single()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Master Recipes</h1>
        <p className="text-gray-500">Resep/BOM: berapa bahan dibutuhkan untuk membuat satu batch produk jadi.</p>
      </div>
      {profile?.outlet_id ? (
        <RecipeManager outletId={profile.outlet_id} canManage={['outlet_manager', 'master_admin'].includes(profile.role)} />
      ) : (
        <Alert variant="warning">Pilih outlet terlebih dahulu.</Alert>
      )}
    </div>
  )
}
