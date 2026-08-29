import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// GET /api/admin/audit-log — master_admin only. See prd.md §4.7.
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (auth.role !== 'master_admin') {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { searchParams } = request.nextUrl
  const page = Number(searchParams.get('page') ?? '1')
  const limit = Math.min(Number(searchParams.get('limit') ?? '50'), 200)
  const actionType = searchParams.get('action_type')
  const entityType = searchParams.get('entity_type')
  const fromDate = searchParams.get('from_date')
  const toDate = searchParams.get('to_date')

  let query = auth.supabase
    .from('audit_log')
    .select('*', { count: 'exact' })
    .eq('company_id', auth.company_id)
    .order('created_at', { ascending: false })

  if (actionType) query = query.eq('action_type', actionType)
  if (entityType) query = query.eq('entity_type', entityType)
  if (fromDate) query = query.gte('created_at', fromDate)
  if (toDate) query = query.lte('created_at', toDate)

  const from = (page - 1) * limit
  const { data, error, count } = await query.range(from, from + limit - 1)

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  const logs = data ?? []
  const actionsByType: Record<string, number> = {}
  for (const log of logs) {
    actionsByType[log.action_type] = (actionsByType[log.action_type] ?? 0) + 1
  }

  return NextResponse.json({
    logs,
    pagination: { page, limit, total: count ?? 0, pages: Math.ceil((count ?? 0) / limit) },
    summary: {
      total_actions: count ?? 0,
      actions_by_type: actionsByType,
      users_active: new Set(logs.map((l) => l.user_id)).size,
    },
  })
}
