import { createClient } from '@/lib/supabase/server'
import { UserManagement } from '@/components/admin/UserManagement'
import { Alert } from '@/components/ui/Alert'

export default async function AdminUsersPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  const { data: profile } = await supabase.from('users').select('role').eq('id', user!.id).single()

  if (profile?.role !== 'master_admin') {
    return <Alert variant="danger">Halaman ini khusus untuk Master Admin.</Alert>
  }

  return <UserManagement />
}
