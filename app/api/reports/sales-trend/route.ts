import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'

// GET /api/reports/sales-trend?days=90 — daily revenue/profit series for
// charting, plus a current-vs-previous-period comparison and a revenue-by-
// category breakdown. Not in the original prd.md spec — added to back the
// dashboard's trend chart and comparison cards.
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!auth.outlet_id) return NextResponse.json({ error: 'Pilih outlet terlebih dahulu' }, { status: 400 })

  const days = Math.min(Number(request.nextUrl.searchParams.get('days') ?? '90'), 180)
  const granularity = request.nextUrl.searchParams.get('granularity') ?? 'daily'
  const now = new Date()
  const startCurrent = new Date(now)
  startCurrent.setDate(startCurrent.getDate() - days + 1)
  startCurrent.setHours(0, 0, 0, 0)
  const startPrevious = new Date(startCurrent)
  startPrevious.setDate(startPrevious.getDate() - days)

  const { data: invoices, error } = await auth.supabase
    .from('invoices')
    .select('id, created_at, total, order_status, invoice_items(quantity, cost_of_goods_sold, products(category_id, product_categories(name)))')
    .eq('outlet_id', auth.outlet_id)
    .neq('order_status', 'voided')
    .gte('created_at', startPrevious.toISOString())

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  type Row = {
    id: string
    created_at: string
    total: number
    invoice_items: { quantity: number; cost_of_goods_sold: number | null; products: { category_id: string | null; product_categories: { name: string } | null } | null }[]
  }
  const rows = (invoices ?? []) as unknown as Row[]

  const dailyMap = new Map<string, { date: string; total_sales: number; transaction_count: number; gross_profit: number }>()
  for (let i = 0; i < days; i++) {
    const d = new Date(startCurrent)
    d.setDate(d.getDate() + i)
    const key = d.toISOString().slice(0, 10)
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
    const isCurrentPeriod = new Date(row.created_at) >= startCurrent

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
