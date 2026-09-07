import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// GET /api/reports/deposit — status breakdown + totals for the Deposit Report.
export async function GET() {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!auth.outlet_id) return NextResponse.json({ error: 'Pilih outlet terlebih dahulu' }, { status: 400 })

  const { data, error } = await auth.supabase
    .from('product_deposits')
    .select('id, customer_name, quantity, deposit_amount, total_price, status, created_at, products(name)')
    .eq('outlet_id', auth.outlet_id)
    .order('created_at', { ascending: false })

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  const deposits = data ?? []
  const byStatus = { pending: 0, fulfilled: 0, cancelled: 0 } as Record<'pending' | 'fulfilled' | 'cancelled', number>
  let totalDeposited = 0
  let totalOutstanding = 0
  for (const d of deposits) {
    byStatus[d.status as 'pending' | 'fulfilled' | 'cancelled'] += 1
    if (d.status !== 'cancelled') totalDeposited += d.deposit_amount
    if (d.status === 'pending') totalOutstanding += d.total_price - d.deposit_amount
  }

  return NextResponse.json({
    deposits,
    summary: { byStatus, totalDeposited, totalOutstanding },
  })
}
