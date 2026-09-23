import { createClient } from '@/lib/supabase/server'
import { JournalEntryManager } from '@/components/accounting/JournalEntryManager'

export default async function JournalPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  const { data: profile } = await supabase.from('users').select('role').eq('id', user!.id).single()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Jurnal Umum</h1>
      <JournalEntryManager canPost={['outlet_manager', 'master_admin'].includes(profile?.role ?? '')} />
    </div>
  )
}
