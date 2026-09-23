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

  const { data: invoice } = await auth.supabase
    .from('purchase_invoices')
    .select('total, purchase_orders(outlet_id)')
    .eq('id', id)
    .single()
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

  // Additive, best-effort journal post (same precedent as PO receiving and
  // expense-request payment elsewhere in this codebase) — PO receiving
  // already posts Dr Persediaan / Cr Utang Usaha when goods arrive; this is
  // the other half, Dr Utang Usaha / Cr Kas-or-Bank, that was missing
  // entirely until now. Without it, Utang Usaha only ever went up in the
  // books and never back down even after a supplier invoice was actually
  // paid off — the AP aging report (computed live from purchase_payments)
  // would correctly show it as paid while the ledger/Balance Sheet still
  // carried the liability forever. Never blocks the real payment: a missing
  // chart-of-accounts entry just skips the posting.
  const outletId = (invoice as unknown as { purchase_orders: { outlet_id: string } | null }).purchase_orders?.outlet_id
  if (outletId) {
    try {
      const cashAccountCode = result.data.payment_method === 'cash' ? '1000' : '1010'
      const [{ data: payableAccount }, { data: cashAccount }] = await Promise.all([
        auth.supabase.from('chart_of_accounts').select('id').eq('outlet_id', outletId).eq('account_code', '2000').maybeSingle(),
        auth.supabase.from('chart_of_accounts').select('id').eq('outlet_id', outletId).eq('account_code', cashAccountCode).maybeSingle(),
      ])
      if (payableAccount && cashAccount) {
        const { data: entryResult } = await auth.supabase
          .rpc('create_journal_entry', {
            p_outlet_id: outletId,
            p_created_by: auth.authUserId,
            p_entry_date: result.data.payment_date,
            p_description: `Pelunasan hutang supplier`,
            p_lines: [
              { account_id: payableAccount.id, debit: result.data.amount, credit: 0, description: payment.id },
              { account_id: cashAccount.id, debit: 0, credit: result.data.amount, description: payment.id },
            ],
            p_source_type: 'purchase_payment',
            p_source_id: payment.id,
          })
          .single()
        if (entryResult) await auth.supabase.rpc('post_journal_entry', { p_entry_id: entryResult.journal_entry_id })
      }
    } catch {
      // Bookkeeping failure must never block a real payment from being recorded.
    }
  }

  return NextResponse.json({ payment, payment_status: paymentStatus }, { status: 201 })
}
