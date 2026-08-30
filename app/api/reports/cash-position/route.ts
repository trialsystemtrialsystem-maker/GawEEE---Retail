import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'

// GET /api/reports/cash-position — see prd.md §4.6
export async function GET() {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!auth.outlet_id) return NextResponse.json({ error: 'Pilih outlet terlebih dahulu' }, { status: 400 })

  // Independent queries — run in parallel (each is a separate network
  // round-trip). `cashAll` fetches just the amount column, unlimited, to
  // total up cash on hand correctly; `cashRecent` is the separate limited
  // query for the "recent transactions" list — these were previously the
  // same limit(10) query, which silently underreported cash on hand for any
  // outlet with more than 10 cash sales.
  const [{ data: outlet }, { data: pendingEwallet }, { data: pendingBank }, { data: cashAll }, { data: cashRecent }] =
    await Promise.all([
      auth.supabase.from('outlets').select('opening_cash').eq('id', auth.outlet_id).single(),
      auth.supabase
        .from('payment_transactions')
        .select('amount, invoices!inner(outlet_id)')
        .eq('invoices.outlet_id', auth.outlet_id)
        .eq('payment_method', 'e_wallet')
        .eq('status', 'pending'),
      auth.supabase
        .from('payment_transactions')
        .select('amount, invoices!inner(outlet_id)')
        .eq('invoices.outlet_id', auth.outlet_id)
        .eq('payment_method', 'bank_transfer')
        .in('status', ['pending', 'processing']),
      auth.supabase
        .from('payment_transactions')
        .select('amount, invoices!inner(outlet_id)')
        .eq('invoices.outlet_id', auth.outlet_id)
        .eq('payment_method', 'cash')
        .eq('status', 'settled'),
      auth.supabase
        .from('payment_transactions')
        .select('amount, created_at, invoices!inner(outlet_id)')
        .eq('invoices.outlet_id', auth.outlet_id)
        .eq('payment_method', 'cash')
        .eq('status', 'settled')
        .order('created_at', { ascending: false })
        .limit(10),
    ])

  const pendingEwalletTotal = (pendingEwallet ?? []).reduce((s, p) => s + p.amount, 0)
  const pendingBankTotal = (pendingBank ?? []).reduce((s, p) => s + p.amount, 0)
  const cashOnHand = (outlet?.opening_cash ?? 0) + (cashAll ?? []).reduce((s, p) => s + p.amount, 0)

  return NextResponse.json({
    as_of: new Date().toISOString(),
    cash_on_hand: cashOnHand,
    pending_e_wallet_settlement: pendingEwalletTotal,
    pending_bank_transfer: pendingBankTotal,
    total_available_cash: cashOnHand,
    recent_transactions: (cashRecent ?? []).map((p) => ({
      type: 'cash',
      amount: p.amount,
      timestamp: p.created_at,
    })),
    cash_flow_forecast_30_days: cashOnHand + pendingEwalletTotal + pendingBankTotal,
  })
}
