import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'
import { resolveOutletScope } from '@/lib/utils/outletScope'
import { selectAll } from '@/lib/utils/fetchAll'

// GET /api/reports/target-vs-actual?outlet_id= — sales target vs. actual
// tracking, one of the most fundamental tools in any enterprise sales
// management system (every CRM/ERP has a quota/target dashboard) that had
// zero coverage here despite outlets.target_daily_revenue existing in the
// schema since the very first migration — defined, even typed in
// database.types.ts, but never read or written by any route or UI until
// now (same "defined but never wired" pattern closed repeatedly this
// session — AR/AP, system_alerts, loyalty redemption). outlet_id=all sums
// every in-scope outlet's target_daily_revenue and actuals together.
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const scopeResult = await resolveOutletScope(auth, request.nextUrl.searchParams.get('outlet_id'))
  if (!scopeResult.scope) return NextResponse.json({ error: scopeResult.error }, { status: scopeResult.status })
  const { outletIds } = scopeResult.scope

  const { data: outlets, error: outletError } = await auth.supabase.from('outlets').select('target_daily_revenue').in('id', outletIds)
  if (outletError) {
    const { status, message } = handleDatabaseError(outletError)
    return NextResponse.json({ error: message }, { status })
  }

  const target = (outlets ?? []).reduce((sum, o) => sum + (o.target_daily_revenue ?? 0), 0)
  if (!target || target <= 0) {
    return NextResponse.json({ configured: false, note: 'Target penjualan harian belum ditetapkan. Atur di menu Pengaturan > Outlet Info.' })
  }

  // Every date boundary here is built and compared in UTC — invoices.created_at
  // is a timestamptz sliced directly to its UTC calendar date, so mixing in
  // any *local*-timezone Date arithmetic (new Date(year, month, day), .getDate(),
  // .getMonth()) would silently shift month/day boundaries by up to a day
  // wherever the server's local timezone isn't UTC itself, both mislabeling
  // the daily chart and letting the wrong invoices into the MTD total.
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth()
  const today = now.toISOString().slice(0, 10)
  const monthStart = new Date(Date.UTC(year, month, 1))
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const daysElapsed = now.getUTCDate() // includes today

  const { data: invoices, error } = await selectAll(auth.supabase
    .from('invoices')
    .select('total, created_at')
    .in('outlet_id', outletIds)
    .neq('order_status', 'voided')
    .gte('created_at', monthStart.toISOString()))

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  const dailyMap = new Map<string, number>()
  for (let d = 1; d <= daysElapsed; d++) {
    const key = new Date(Date.UTC(year, month, d)).toISOString().slice(0, 10)
    dailyMap.set(key, 0)
  }
  let mtdActual = 0
  for (const inv of invoices ?? []) {
    const day = inv.created_at.slice(0, 10)
    mtdActual += inv.total
    if (dailyMap.has(day)) dailyMap.set(day, (dailyMap.get(day) ?? 0) + inv.total)
  }

  const todayActual = dailyMap.get(today) ?? 0
  const mtdTarget = target * daysElapsed
  const monthTarget = target * daysInMonth
  const daysRemaining = daysInMonth - daysElapsed
  const remainingToHitMonthTarget = Math.max(0, monthTarget - mtdActual)
  const requiredDailyPace = daysRemaining > 0 ? remainingToHitMonthTarget / daysRemaining : remainingToHitMonthTarget

  const daily = Array.from(dailyMap.entries())
    .map(([date, actual]) => ({ date, actual, target }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return NextResponse.json({
    configured: true,
    target_daily_revenue: target,
    today: { date: today, actual: todayActual, target, achievement_pct: (todayActual / target) * 100 },
    mtd: {
      actual: mtdActual,
      target: mtdTarget,
      achievement_pct: mtdTarget > 0 ? (mtdActual / mtdTarget) * 100 : 0,
      month_target: monthTarget,
      month_achievement_pct: monthTarget > 0 ? (mtdActual / monthTarget) * 100 : 0,
    },
    pace: {
      days_remaining: daysRemaining,
      remaining_to_hit_month_target: remainingToHitMonthTarget,
      required_daily_pace: requiredDailyPace,
    },
    daily,
  })
}
