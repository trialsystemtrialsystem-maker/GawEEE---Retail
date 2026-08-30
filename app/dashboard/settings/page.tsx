import { createClient } from '@/lib/supabase/server'
import { Alert } from '@/components/ui/Alert'
import { OutletSettingsForm } from '@/components/settings/OutletSettingsForm'

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  const { data: profile } = await supabase.from('users').select('outlet_id, role').eq('id', user!.id).single()

  if (!profile?.outlet_id) {
    return <Alert variant="warning">Pilih outlet terlebih dahulu.</Alert>
  }

  const { data: outlet } = await supabase.from('outlets').select('*').eq('id', profile.outlet_id).single()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Outlet Info</h1>
      {outlet ? (
        <OutletSettingsForm outlet={outlet} canManage={['outlet_manager', 'master_admin'].includes(profile.role)} />
      ) : (
        <Alert variant="danger">Data outlet tidak ditemukan.</Alert>
      )}
    </div>
  )
}
