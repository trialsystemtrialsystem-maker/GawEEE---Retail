import { createClient } from '@/lib/supabase/server'
import { BudgetManager } from '@/components/accounting/BudgetManager'
import { loadPermissionOverrides, resolvePermission } from '@/lib/utils/permissions'

export default async function BudgetPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const { data: profile } = await supabase.from('users').select('role, company_id').eq('id', session!.user.id).single()
  const overrides = profile ? await loadPermissionOverrides(supabase, profile.company_id) : {}

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Anggaran vs Realisasi</h1>
        <p className="text-gray-500">Tetapkan target pendapatan dan batas beban per bulan, lalu pantau selisihnya dari jurnal yang sudah diposting.</p>
      </div>
      <BudgetManager canManage={resolvePermission(profile?.role ?? '', 'journal.post', overrides)} />
    </div>
  )
}
