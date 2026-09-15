import { createClient } from '@/lib/supabase/server'
import { Alert } from '@/components/ui/Alert'
import { RecipeChangeScheduler } from '@/components/inventory/RecipeChangeScheduler'

export default async function RecipeChangesPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  const { data: profile } = await supabase.from('users').select('outlet_id').eq('id', user!.id).single()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Scheduling Recipe Changes</h1>
        <p className="text-gray-500">Jadwalkan perubahan bahan resep produksi yang berlaku otomatis di tanggal tertentu.</p>
      </div>
      {profile?.outlet_id ? (
        <RecipeChangeScheduler outletId={profile.outlet_id} />
      ) : (
        <Alert variant="warning">Pilih outlet terlebih dahulu.</Alert>
      )}
    </div>
  )
}
