import { createClient } from '@/lib/supabase/server'
import { Alert } from '@/components/ui/Alert'
import { SystemSettingsForm } from '@/components/admin/SystemSettingsForm'

export default async function SystemSettingsPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const { data: profile } = await supabase.from('users').select('role').eq('id', session!.user.id).single()

  if (profile?.role !== 'master_admin') {
    return <Alert variant="danger">Halaman ini khusus untuk Master Admin.</Alert>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pengaturan Sistem</h1>
        <p className="text-gray-500">Identitas bisnis, tarif pajak, dan teks struk untuk seluruh outlet.</p>
      </div>
      <SystemSettingsForm />
    </div>
  )
}
