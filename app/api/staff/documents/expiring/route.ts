import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { handleDatabaseError } from '@/lib/utils/errors'

// GET /api/staff/documents/expiring?outlet_id=&days=60 — documents already
// expired or expiring within `days`, soonest first. Managers only.
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['outlet_manager', 'master_admin'].includes(auth.role)) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })

  const { searchParams } = request.nextUrl
  const outletId = searchParams.get('outlet_id') ?? auth.outlet_id
  if (!outletId || !canAccessOutlet(auth, outletId)) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  const days = Math.min(365, Math.max(1, Number(searchParams.get('days') ?? 60) || 60))
  const limit = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)

  const { data, error } = await auth.supabase
    .from('employee_documents')
    .select('id, staff_id, doc_type, title, expires_on, staff_members(first_name, last_name)')
    .eq('outlet_id', outletId)
    .not('expires_on', 'is', null)
    .lte('expires_on', limit)
    .order('expires_on', { ascending: true })
  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  const today = new Date().toISOString().slice(0, 10)
  type Row = { id: string; staff_id: string; doc_type: string; title: string; expires_on: string; staff_members: { first_name: string; last_name: string | null } | { first_name: string; last_name: string | null }[] | null }
  return NextResponse.json({
    documents: ((data ?? []) as unknown as Row[]).map((d) => {
      const sm = Array.isArray(d.staff_members) ? d.staff_members[0] : d.staff_members
      return { id: d.id, staff_id: d.staff_id, doc_type: d.doc_type, title: d.title, expires_on: d.expires_on, staff_name: sm ? `${sm.first_name} ${sm.last_name ?? ''}`.trim() : '-', expired: d.expires_on < today }
    }),
  })
}
