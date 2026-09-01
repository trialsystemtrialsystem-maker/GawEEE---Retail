import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// GET /api/notifications?outlet_id= — read-time aggregation, not a
// "remember to insert an alert everywhere" system: combines system_alerts
// (unresolved), v_low_stock_alerts (existing view), and counts of pending
// item_requests/expense_requests/purchase_orders awaiting approval. No
// write-path changes anywhere else in the app.
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const outletId = request.nextUrl.searchParams.get('outlet_id') ?? auth.outlet_id
  if (!outletId || !canAccessOutlet(auth, outletId)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const [alertsRes, lowStockRes, itemRequestsRes, expenseRequestsRes, poRes] = await Promise.all([
    auth.supabase
      .from('system_alerts')
      .select('*')
      .eq('outlet_id', outletId)
      .eq('is_resolved', false)
      .order('created_at', { ascending: false })
      .limit(20),
    auth.supabase.from('v_low_stock_alerts').select('product_id', { count: 'exact', head: true }).eq('outlet_id', outletId),
    auth.supabase.from('item_requests').select('id', { count: 'exact', head: true }).eq('outlet_id', outletId).eq('status', 'pending'),
    auth.supabase.from('expense_requests').select('id', { count: 'exact', head: true }).eq('outlet_id', outletId).eq('status', 'pending'),
    auth.supabase.from('purchase_orders').select('id', { count: 'exact', head: true }).eq('outlet_id', outletId).eq('status', 'pending_approval'),
  ])

  if (alertsRes.error) {
    const { status, message } = handleDatabaseError(alertsRes.error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({
    alerts: alertsRes.data ?? [],
    pendingApprovals: {
      itemRequests: itemRequestsRes.count ?? 0,
      expenseRequests: expenseRequestsRes.count ?? 0,
      purchaseOrders: poRes.count ?? 0,
    },
    lowStockCount: lowStockRes.count ?? 0,
  })
}
