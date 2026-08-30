import { createClient } from '@/lib/supabase/server'
import { Alert } from '@/components/ui/Alert'
import { StaffAnnouncements } from '@/components/staff/StaffAnnouncements'

export default async function StaffNotificationsPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  const { data: profile } = await supabase.from('users').select('outlet_id, role').eq('id', user!.id).single()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Notifikasi Karyawan</h1>
        <p className="text-gray-500">Pengumuman internal untuk tim — belum terhubung ke push notification asli.</p>
      </div>
      {profile?.outlet_id ? (
        <StaffAnnouncements outletId={profile.outlet_id} canPost={['outlet_manager', 'master_admin'].includes(profile.role)} />
      ) : (
        <Alert variant="warning">Pilih outlet terlebih dahulu.</Alert>
      )}
    </div>
  )
}
