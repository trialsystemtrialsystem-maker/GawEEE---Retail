import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// GET /api/reports/promo-loyalty — coupon usage, loyalty points issued vs
// redeemed per month, and the active promotions list. Promotions have no
// usage-tracking column in the schema (confirmed) — only coupons/loyalty
// get real usage numbers here, disclosed in the response.
export async function GET() {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!auth.outlet_id) return NextResponse.json({ error: 'Pilih outlet terlebih dahulu' }, { status: 400 })

  const [couponsRes, promotionsRes, customersRes] = await Promise.all([
    auth.supabase.from('coupons').select('code, discount_type, discount_value, usage_count, usage_limit, is_active').eq('outlet_id', auth.outlet_id).order('usage_count', { ascending: false }),
    auth.supabase.from('promotions').select('name, discount_type, discount_value, start_date, end_date, is_active').eq('outlet_id', auth.outlet_id).eq('is_active', true),
    auth.supabase.from('customers').select('id').eq('outlet_id', auth.outlet_id),
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
