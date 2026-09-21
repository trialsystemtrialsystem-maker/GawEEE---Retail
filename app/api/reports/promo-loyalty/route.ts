import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'
import { resolveOutletScope } from '@/lib/utils/outletScope'

// GET /api/reports/promo-loyalty?outlet_id= — coupon usage, loyalty points
// issued vs redeemed per month, and the active promotions list. Promotions
// have no usage-tracking column in the schema (confirmed) — only coupons/
// loyalty get real usage numbers here, disclosed in the response. Coupons/
// promotions are current-state lists (not date-filtered), so only the
// outlet scope applies here, not a date range.
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const scopeResult = await resolveOutletScope(auth, request.nextUrl.searchParams.get('outlet_id'))
  if (!scopeResult.scope) return NextResponse.json({ error: scopeResult.error }, { status: scopeResult.status })
  const { outletIds } = scopeResult.scope

  const [couponsRes, promotionsRes, customersRes] = await Promise.all([
    auth.supabase.from('coupons').select('code, discount_type, discount_value, usage_count, usage_limit, is_active').in('outlet_id', outletIds).order('usage_count', { ascending: false }),
    auth.supabase.from('promotions').select('name, discount_type, discount_value, start_date, end_date, is_active').in('outlet_id', outletIds).eq('is_active', true),
    auth.supabase.from('customers').select('id').in('outlet_id', outletIds),
  ])

  if (couponsRes.error) {
    const { status, message } = handleDatabaseError(couponsRes.error)
    return NextResponse.json({ error: message }, { status })
  }

  const customerIds = (customersRes.data ?? []).map((c) => c.id)
  let loyaltyByMonth: { month: string; issued: number; redeemed: number }[] = []
  if (customerIds.length > 0) {
    const { data: ledger } = await auth.supabase.from('loyalty_ledger').select('points_change, created_at').in('customer_id', customerIds)
    const byMonth = new Map<string, { issued: number; redeemed: number }>()
    for (const row of ledger ?? []) {
      const month = row.created_at.slice(0, 7)
      const entry = byMonth.get(month) ?? { issued: 0, redeemed: 0 }
      if (row.points_change > 0) entry.issued += row.points_change
      else entry.redeemed += Math.abs(row.points_change)
      byMonth.set(month, entry)
    }
    loyaltyByMonth = Array.from(byMonth.entries())
      .map(([month, v]) => ({ month, ...v }))
      .sort((a, b) => a.month.localeCompare(b.month))
  }

  return NextResponse.json({
    coupons: couponsRes.data ?? [],
    promotions: promotionsRes.data ?? [],
    loyaltyByMonth,
    note: 'Promosi belum memiliki kolom pelacakan penggunaan otomatis — hanya kupon dan poin loyalitas yang menampilkan angka pemakaian sesungguhnya.',
  })
}
