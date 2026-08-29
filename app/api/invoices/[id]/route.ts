import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'

// GET /api/invoices/:id — see prd.md §4.3
export async function GET(_request: NextRequest, ctx: RouteContext<'/api/invoices/[id]'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params

  const { data: invoice, error } = await auth.supabase.from('invoices').select('*').eq('id', id).single()
  if (error || !invoice) {
    return NextResponse.json({ error: 'Invoice tidak ditemukan' }, { status: 404 })
  }

  const { data: items } = await auth.supabase.from('invoice_items').select('*').eq('invoice_id', id)
  const { data: payments } = await auth.supabase.from('payment_transactions').select('*').eq('invoice_id', id)
  const { data: auditTrail } = await auth.supabase
    .from('audit_log')
    .select('*')
    .eq('entity_type', 'invoice')
    .eq('entity_id', id)
    .order('created_at', { ascending: false })

  return NextResponse.json({
    invoice,
    items: items ?? [],
    payments: payments ?? [],
    audit_trail: auditTrail ?? [],
  })
}
