import { createClient } from '@/lib/supabase/server'
import { InvoiceDetail } from '@/components/sales/InvoiceDetail'

export default async function InvoiceDetailPage({ params }: PageProps<'/dashboard/sales/[invoiceId]'>) {
  const { invoiceId } = await params
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  const { data: profile } = await supabase.from('users').select('role').eq('id', user!.id).single()

  return <InvoiceDetail invoiceId={invoiceId} canVoid={['outlet_manager', 'master_admin'].includes(profile?.role ?? '')} />
}
