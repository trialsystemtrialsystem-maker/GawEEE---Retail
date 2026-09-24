import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'

// GET /api/receipt-settings — any authenticated user (the POS cashier needs
// it to print a receipt). Only the fields a receipt shows; the full editable
// settings live behind /api/admin/company-settings (master_admin only).
export async function GET() {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await auth.supabase.from('companies').select('name, tax_id, settings').eq('id', auth.company_id).single()
  const settings = (data?.settings ?? {}) as { receipt_header?: string; receipt_footer?: string }
  return NextResponse.json({
    name: data?.name ?? 'GawEEE',
    tax_id: data?.tax_id ?? null,
    receipt_header: settings.receipt_header ?? '',
    receipt_footer: settings.receipt_footer ?? '',
  })
}
