import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'

// GET /api/reports/cash-position — see prd.md §4.6
export async function GET() {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!auth.outlet_id) return NextResponse.json({ error: 'Pilih outlet terlebih dahulu' }, { status: 400 })

  const { data: outlet } = await auth.supabase.from('outlets').select('opening_cash').eq('id', auth.outlet_id).single()

  const { data: pendingEwallet } = await auth.supabase
    .from('payment_transactions')
    .select('amount, invoices!inner(outlet_id)')
    .eq('invoices.outlet_id', auth.outlet_id)
    .eq('payment_method', 'e_wallet')
    .eq('status', 'pending')

  const { data: pendingBank } = await auth.supabase
    .from('payment_transactions')
    .select('amount, invoices!inner(outlet_id)')
    .eq('invoices.outlet_id', auth.outlet_id)
    .eq('payment_method', 'bank_transfer')
    .in('status', ['pending', 'processing'])

  const { data: cashSettled } = await auth.supabase
    .from('payment_transactions')
    .select('amount, created_at, invoices!inner(outlet_id)')
    .eq('invoices.outlet_id', auth.outlet_id)
    .eq('payment_method', 'cash')
    .eq('status', 'settled')
    .order('created_at', { ascending: false })
    .limit(10)

  const pendingEwalletTotal = (pendingEwallet ?? []).reduce((s, p) => s + p.amount, 0)
  const pendingBankTotal = (pendingBank ?? []).reduce((s, p) => s + p.amount, 0)
  const cashOnHand = (outlet?.opening_cash ?? 0) + (cashSettled ?? []).reduce((s, p) => s + p.amount, 0)

  return NextResponse.json({
    as_of: new Date().toISOString(),
    cash_on_hand: cashOnHand,
    pending_e_wallet_settlement: pendingEwalletTotal,
    pending_bank_transfer: pendingBankTotal,
    total_available_cash: cashOnHand,
    recent_transactions: (cashSettled ?? []).map((p) => ({
      type: 'cash',
      amount: p.amount,
      timestamp: p.created_at,
    })),
    cash_flow_forecast_30_days: cashOnHand + pendingEwalletTotal + pendingBankTotal,
  })
}
