import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { resolveDateRange } from '@/lib/utils/dateRange'
import { resolveOutletScope } from '@/lib/utils/outletScope'
import { selectAll } from '@/lib/utils/fetchAll'
import { normalizePhone } from '@/lib/utils/customerInsights'
import { summarize, trend, deltaPct, previousRange, rankLines, topCustomers, isSale, type SaleInvoice, type Group } from '@/lib/utils/salesSummary'

type RawInvoice = {
  id: string
  outlet_id: string
  created_at: string
  subtotal: number
  discount_amount: number
  tax_amount: number
  total: number
  payment_status: SaleInvoice['payment_status']
  order_status: SaleInvoice['order_status']
  cashier_id: string
  customer_name: string | null
  customer_phone: string | null
  invoice_items: { product_id: string; quantity: number; subtotal: number; cost_of_goods_sold: number | null; products: { name: string; category_id: string | null } | null }[]
}

const SELECT =
  'id, outlet_id, created_at, subtotal, discount_amount, tax_amount, total, payment_status, order_status, cashier_id, customer_name, customer_phone, invoice_items(product_id, quantity, subtotal, cost_of_goods_sold, products(name, category_id))'

// GET /api/reports/sales-summary?start=&end=&outlet_id=&group=day|week|month
// One report answering "how did we sell": totals vs the previous equal
// period, trend, payment methods, categories, products, cashiers, customers,
// and (for an owner viewing all outlets) outlets. Paged so a busy range is
// never silently cut at PostgREST's 1000 rows.
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const scopeResult = await resolveOutletScope(auth, searchParams.get('outlet_id'))
  if (!scopeResult.scope) return NextResponse.json({ error: scopeResult.error }, { status: scopeResult.status })
  const { outletIds, isAll } = scopeResult.scope
  const range = resolveDateRange(searchParams, 30, 400)
  const groupParam = searchParams.get('group')
  const group: Group = groupParam === 'week' || groupParam === 'month' ? groupParam : 'day'
  const prev = previousRange(range.startDate, range.endDate)

  const fetchInvoices = async (start: string, end: string) => {
    const { data, error } = await selectAll(
      auth.supabase.from('invoices').select(SELECT).in('outlet_id', outletIds).gte('created_at', `${start}T00:00:00.000Z`).lte('created_at', `${end}T23:59:59.999Z`)
    )
    if (error) throw error
    return (data ?? []) as unknown as RawInvoice[]
  }

  try {
    const [cur, before, paymentsRes, usersRes, catsRes, outletsRes] = await Promise.all([
      fetchInvoices(range.startDate, range.endDate),
      fetchInvoices(prev.start, prev.end),
      selectAll(
        auth.supabase
          .from('payment_transactions')
          .select('payment_method, amount, invoices!inner(outlet_id, order_status)')
          .in('invoices.outlet_id', outletIds)
          .eq('status', 'settled')
          .gte('created_at', range.startIso)
          .lte('created_at', range.endIso)
      ),
      auth.supabase.from('users').select('id, full_name, email').eq('company_id', auth.company_id),
      auth.supabase.from('product_categories').select('id, name').eq('company_id', auth.company_id),
      isAll ? auth.supabase.from('outlets').select('id, name').in('id', outletIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    ])

    const catName = new Map((catsRes.data ?? []).map((c) => [c.id, c.name]))
    const userName = new Map((usersRes.data ?? []).map((u) => [u.id, u.full_name || u.email]))
    const outletName = new Map((outletsRes.data ?? []).map((o) => [o.id, o.name]))

    const toSale = (r: RawInvoice): SaleInvoice => {
      const phone = normalizePhone(r.customer_phone)
      const name = r.customer_name?.trim() || null
      return {
        id: r.id,
        created_at: r.created_at,
        subtotal: Number(r.subtotal),
        discount_amount: Number(r.discount_amount),
        tax_amount: Number(r.tax_amount),
        total: Number(r.total),
        payment_status: r.payment_status,
        order_status: r.order_status,
        cashier_id: r.cashier_id,
        customer_key: phone || (name ? name.toLowerCase() : null),
        customer_name: name,
        lines: (r.invoice_items ?? []).map((l) => ({
          product_id: l.product_id,
          name: l.products?.name ?? 'Produk',
          category: (l.products?.category_id && catName.get(l.products.category_id)) || 'Tanpa kategori',
          quantity: Number(l.quantity),
          subtotal: Number(l.subtotal),
          cogs: l.cost_of_goods_sold == null ? null : Number(l.cost_of_goods_sold),
        })),
      }
    }
    const sales = cur.map(toSale)
    const totals = summarize(sales)
    const previous = summarize(before.map(toSale))

    const payments = new Map<string, number>()
    for (const p of (paymentsRes.data ?? []) as unknown as { payment_method: string; amount: number; invoices: { order_status: string } | { order_status: string }[] }[]) {
      const inv = Array.isArray(p.invoices) ? p.invoices[0] : p.invoices
      if (inv?.order_status === 'voided') continue
      payments.set(p.payment_method, (payments.get(p.payment_method) ?? 0) + Number(p.amount))
    }

    const cashiers = new Map<string, { key: string; name: string; count: number; total: number }>()
    for (const s of sales) {
      if (!isSale(s)) continue
      const c = cashiers.get(s.cashier_id) ?? { key: s.cashier_id, name: userName.get(s.cashier_id) ?? 'Kasir', count: 0, total: 0 }
      c.count += 1
      c.total += s.total
      cashiers.set(s.cashier_id, c)
    }

    const outlets = new Map<string, { key: string; name: string; count: number; total: number }>()
    if (isAll) {
      for (const r of cur) {
        if (r.order_status !== 'completed') continue
        const o = outlets.get(r.outlet_id) ?? { key: r.outlet_id, name: outletName.get(r.outlet_id) ?? 'Outlet', count: 0, total: 0 }
        o.count += 1
        o.total += Number(r.total)
        outlets.set(r.outlet_id, o)
      }
    }

    return NextResponse.json({
      range: { start: range.startDate, end: range.endDate, previous: prev },
      group,
      totals,
      previous,
      deltas: {
        total: deltaPct(totals.total, previous.total),
        invoice_count: deltaPct(totals.invoice_count, previous.invoice_count),
        avg_basket: deltaPct(totals.avg_basket, previous.avg_basket),
        gross_profit: deltaPct(totals.gross_profit, previous.gross_profit),
        discount: deltaPct(totals.discount, previous.discount),
      },
      trend: trend(sales, group),
      byPayment: [...payments.entries()].map(([method, amount]) => ({ method, amount })).sort((a, b) => b.amount - a.amount),
      byCategory: rankLines(sales, (l) => ({ key: l.category, label: l.category }), 15),
      topProducts: rankLines(sales, (l) => ({ key: l.product_id, label: l.name }), 15),
      byCashier: [...cashiers.values()].sort((a, b) => b.total - a.total),
      topCustomers: topCustomers(sales, 10),
      byOutlet: [...outlets.values()].sort((a, b) => b.total - a.total),
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Gagal memuat laporan' }, { status: 500 })
  }
}
