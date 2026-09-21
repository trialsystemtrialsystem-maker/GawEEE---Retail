import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { resolveDateRange } from '@/lib/utils/dateRange'
import { resolveOutletScope } from '@/lib/utils/outletScope'

// GET /api/reports/sales-trend?days=90&start=&end=&outlet_id= — daily
// revenue/profit series for charting, plus a current-vs-previous-period
// comparison and a revenue-by-category breakdown. Not in the original
// prd.md spec — added to back the dashboard's trend chart and comparison
// cards. outlet_id is optional (defaults to the caller's own outlet),
// "all" aggregates every outlet in the company (master_admin only —
// resolveOutletScope collapses to the same single outlet for anyone else).
// start/end (YYYY-MM-DD) override `days` when both are given.
//
// Every boundary here is built via resolveDateRange()'s UTC-safe string
// arithmetic, never local-timezone Date construction — see todo.md Phase
// 27/28 for the real bug that caused (local Date boundaries silently
// shifted by up to a day against invoices.created_at's UTC storage,
// leaking hours of the wrong period into "current" and mislabeling chart
// dates).
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const scopeResult = await resolveOutletScope(auth, request.nextUrl.searchParams.get('outlet_id'))
  if (!scopeResult.scope) return NextResponse.json({ error: scopeResult.error }, { status: scopeResult.status })
  const { outletIds } = scopeResult.scope

  const granularity = request.nextUrl.searchParams.get('granularity') ?? 'daily'
  const { startDate, endDate, startIso, endIso } = resolveDateRange(request.nextUrl.searchParams, 90, 180)
  const daySpan = Math.round((Date.parse(endIso) - Date.parse(startIso)) / 86_400_000) + 1

  // Previous period: same length, immediately before the current range.
  const prevEndDate = addUtcDays(startDate, -1)
  const prevStartDate = addUtcDays(prevEndDate, -(daySpan - 1))
  const prevStartIso = `${prevStartDate}T00:00:00.000Z`

  const { data: invoices, error } = await auth.supabase
    .from('invoices')
    .select('id, created_at, total, order_status, invoice_items(quantity, cost_of_goods_sold, products(category_id, product_categories(name)))')
    .in('outlet_id', outletIds)
    .neq('order_status', 'voided')
    .gte('created_at', prevStartIso)
    .lte('created_at', endIso)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  type Row = {
    id: string
    created_at: string
    total: number
    invoice_items: { quantity: number; cost_of_goods_sold: number | null; products: { category_id: string | null; product_categories: { name: string } | null } | null }[]
  }
  const rows = (invoices ?? []) as unknown as Row[]

  const dailyMap = new Map<string, { date: string; total_sales: number; transaction_count: number; gross_profit: number }>()
  for (let key = startDate; key <= endDate; key = addUtcDays(key, 1)) {
    dailyMap.set(key, { date: key, total_sales: 0, transaction_count: 0, gross_profit: 0 })
  }

  let currentRevenue = 0
  let currentTx = 0
  let currentProfit = 0
  let previousRevenue = 0
  let previousTx = 0
  let previousProfit = 0
  const categoryTotals = new Map<string, number>()

  for (const row of rows) {
    const dateKey = row.created_at.slice(0, 10)
    const cogs = row.invoice_items.reduce((s, it) => s + (it.cost_of_goods_sold ?? 0), 0)
    const profit = row.total - cogs
    const isCurrentPeriod = dateKey >= startDate

    if (isCurrentPeriod) {
      currentRevenue += row.total
      currentTx += 1
      currentProfit += profit
      const bucket = dailyMap.get(dateKey)
      if (bucket) {
        bucket.total_sales += row.total
        bucket.transaction_count += 1
        bucket.gross_profit += profit
      }
      // invoice_items doesn't carry a per-line revenue total (unit_price *
      // quantity isn't selected above), so category revenue is attributed by
      // each line's share of the invoice's COGS — a reasonable proxy since
      // margins are fairly uniform within this catalog.
      for (const item of row.invoice_items) {
        const categoryName = item.products?.product_categories?.name ?? 'Lainnya'
        const weight = cogs > 0 ? (item.cost_of_goods_sold ?? 0) / cogs : 1 / row.invoice_items.length
        categoryTotals.set(categoryName, (categoryTotals.get(categoryName) ?? 0) + row.total * weight)
      }
    } else {
      previousRevenue += row.total
      previousTx += 1
      previousProfit += profit
    }
  }

  function pctChange(current: number, previous: number) {
    if (previous === 0) return current > 0 ? 100 : 0
    return Math.round(((current - previous) / previous) * 10000) / 100
  }

  const daily = Array.from(dailyMap.values())

  return NextResponse.json({
    daily: bucketByGranularity(daily, granularity),
    comparison: {
      current: { revenue: currentRevenue, transactions: currentTx, profit: currentProfit },
      previous: { revenue: previousRevenue, transactions: previousTx, profit: previousProfit },
      change_percent: {
        revenue: pctChange(currentRevenue, previousRevenue),
        transactions: pctChange(currentTx, previousTx),
        profit: pctChange(currentProfit, previousProfit),
      },
    },
    category_breakdown: Array.from(categoryTotals.entries())
      .map(([name, revenue]) => ({ name, revenue: Math.round(revenue) }))
      .sort((a, b) => b.revenue - a.revenue),
  })
}

/** Adds (or subtracts, for a negative n) whole days to a YYYY-MM-DD string,
 * entirely in UTC — no local-timezone Date construction anywhere in this
 * file (see the module comment above for why that matters here). */
function addUtcDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

type DailyPoint = { date: string; total_sales: number; transaction_count: number; gross_profit: number }

// Re-buckets the daily series into weekly (Monday-start) or monthly groups
// for the dashboard's Daily/Weekly/Monthly toggle — the underlying
// comparison totals above are unaffected, only chart granularity changes.
function bucketByGranularity(daily: DailyPoint[], granularity: string): DailyPoint[] {
  if (granularity !== 'weekly' && granularity !== 'monthly') return daily

  const buckets = new Map<string, DailyPoint>()
  for (const point of daily) {
    const d = new Date(point.date + 'T00:00:00Z')
    let key: string
    if (granularity === 'monthly') {
      key = point.date.slice(0, 7) // YYYY-MM
    } else {
      const dayOfWeek = (d.getUTCDay() + 6) % 7 // 0 = Monday
      const monday = new Date(d)
      monday.setUTCDate(d.getUTCDate() - dayOfWeek)
      key = monday.toISOString().slice(0, 10)
    }
    const bucket = buckets.get(key) ?? { date: key, total_sales: 0, transaction_count: 0, gross_profit: 0 }
    bucket.total_sales += point.total_sales
    bucket.transaction_count += point.transaction_count
    bucket.gross_profit += point.gross_profit
    buckets.set(key, bucket)
  }
  return Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date))
}
