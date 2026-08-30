import { createClient } from '@/lib/supabase/server'
import { AccessRightsManager } from '@/components/staff/AccessRightsManager'

export default async function AccessRightsPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  const { data: profile } = await supabase.from('users').select('role').eq('id', user!.id).single()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Hak Akses</h1>
      <AccessRightsManager isMasterAdmin={profile?.role === 'master_admin'} />
    </div>
  )
}
