import { createClient } from '@/lib/supabase/server'
import { InvoiceDetail } from '@/components/sales/InvoiceDetail'
import { loadPermissionOverrides, resolvePermission } from '@/lib/utils/permissions'

export default async function InvoiceDetailPage({ params }: PageProps<'/dashboard/sales/[invoiceId]'>) {
  const { invoiceId } = await params
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  const { data: profile } = await supabase.from('users').select('role, company_id').eq('id', user!.id).single()

  // Same keys the void/refund API routes enforce (lib/utils/permissions.ts),
  // so the buttons hide for exactly the roles the API would reject.
  const overrides = profile ? await loadPermissionOverrides(supabase, profile.company_id) : {}
  const role = profile?.role ?? ''
  return (
    <InvoiceDetail
      invoiceId={invoiceId}
      canVoid={resolvePermission(role, 'invoice.void', overrides)}
      canRefund={resolvePermission(role, 'refund.process', overrides)}
    />
  )
}
