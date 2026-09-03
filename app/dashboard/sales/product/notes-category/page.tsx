import { createClient } from '@/lib/supabase/server'
import { Alert } from '@/components/ui/Alert'
import { NotePresetManager } from '@/components/products/NotePresetManager'

export default async function NotesCategoryPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  const { data: profile } = await supabase.from('users').select('outlet_id').eq('id', user!.id).single()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Notes Category List</h1>
        <p className="text-gray-500">Daftar catatan siap-pakai yang bisa dipilih kasir untuk setiap item di keranjang.</p>
      </div>
      {profile?.outlet_id ? <NotePresetManager outletId={profile.outlet_id} /> : <Alert variant="warning">Pilih outlet terlebih dahulu.</Alert>}
    </div>
  )
}
