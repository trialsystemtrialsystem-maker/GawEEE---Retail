import { createClient } from '@/lib/supabase/server'
import { TaxReport } from '@/components/financial/TaxReport'
import { PphFinalCard } from '@/components/financial/PphFinalCard'

export default async function TaxReportPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const { data: profile } = await supabase.from('users').select('role').eq('id', session!.user.id).single()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Tax Report</h1>
      <TaxReport />
      <PphFinalCard isMaster={profile?.role === 'master_admin'} />
    </div>
  )
}
