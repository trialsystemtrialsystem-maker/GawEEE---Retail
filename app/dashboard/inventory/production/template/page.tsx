import { createClient } from '@/lib/supabase/server'
import { Alert } from '@/components/ui/Alert'
import { RecipeManager } from '@/components/inventory/RecipeManager'

// "Stock Production Template" and "Master Recipes" (Sales > Product) are the
// same concept — a template is a recipe — so this renders the same manager
// rather than a second half-duplicated feature.
export default async function StockProductionTemplatePage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  const { data: profile } = await supabase.from('users').select('outlet_id, role').eq('id', user!.id).single()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Stock Production Template</h1>
        <p className="text-gray-500">Sama dengan Master Recipes — kelola template/resep produksi di sini.</p>
      </div>
      {profile?.outlet_id ? (
        <RecipeManager outletId={profile.outlet_id} canManage={['outlet_manager', 'master_admin'].includes(profile.role)} />
      ) : (
        <Alert variant="warning">Pilih outlet terlebih dahulu.</Alert>
      )}
    </div>
  )
}
