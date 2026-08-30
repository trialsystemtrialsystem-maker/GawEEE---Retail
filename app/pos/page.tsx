import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { POSScreen } from '@/components/pos/POSScreen'

export const metadata = { title: 'Kasir | GawEEE' }

export default async function POSPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, outlet_id')
    .eq('id', user.id)
    .single()

  if (!profile?.outlet_id) {
    redirect('/dashboard')
  }

  return <POSScreen outletId={profile.outlet_id} cashierName={profile.full_name} />
}
