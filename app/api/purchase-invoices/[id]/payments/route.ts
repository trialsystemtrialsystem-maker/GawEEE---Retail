import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { validate, recordPurchasePaymentSchema } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'

// GET /api/purchase-invoices/:id/payments
export async function GET(_request: NextRequest, ctx: RouteContext<'/api/purchase-invoices/[id]/payments'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const { data, error } = await auth.supabase
    .from('purchase_payments')
    .select('*')
    .eq('purchase_invoice_id', id)
    .order('payment_date', { ascending: false })

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ payments: data })
}

// POST /api/purchase-invoices/:id/payments — manager+ only. Records a
// payment and updates the invoice's payment_status (unpaid/partial/paid).
export async function POST(request: NextRequest, ctx: RouteContext<'/api/purchase-invoices/[id]/payments'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['outlet_manager', 'master_admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { id } = await ctx.params
  const body = await request.json()
  const result = validate(recordPurchasePaymentSchema, body)
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })

  const { data: invoice } = await auth.supabase.from('purchase_invoices').select('total').eq('id', id).single()
  if (!invoice) return NextResponse.json({ error: 'Invoice tidak ditemukan' }, { status: 404 })

  const { data: payment, error } = await auth.supabase
    .from('purchase_payments')
    .insert({ ...result.data, purchase_invoice_id: id, recorded_by: auth.id })
    .select()
    .single()

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  const { data: allPayments } = await auth.supabase.from('purchase_payments').select('amount').eq('purchase_invoice_id', id)
  const totalPaid = (allPayments ?? []).reduce((s, p) => s + p.amount, 0)
  const paymentStatus = totalPaid >= (invoice.total ?? 0) ? 'paid' : totalPaid > 0 ? 'partial' : 'unpaid'

  await auth.supabase.from('purchase_invoices').update({ payment_status: paymentStatus }).eq('id', id)

  return NextResponse.json({ payment, payment_status: paymentStatus }, { status: 201 })
}
