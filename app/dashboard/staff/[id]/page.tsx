import { createClient } from '@/lib/supabase/server'
import { EmployeeProfile } from '@/components/staff/employee/EmployeeProfile'
import { loadPermissionOverrides, resolvePermission } from '@/lib/utils/permissions'

export default async function EmployeeProfilePage({ params }: PageProps<'/dashboard/staff/[id]'>) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const { data: profile } = await supabase.from('users').select('role, company_id').eq('id', session!.user.id).single()
  // Same permission the kasbon/payroll routes enforce, so action buttons hide
  // for exactly the roles the API would reject.
  const overrides = profile ? await loadPermissionOverrides(supabase, profile.company_id) : {}
  return <EmployeeProfile staffId={id} canManage={resolvePermission(profile?.role ?? '', 'payroll.manage', overrides)} />
}
