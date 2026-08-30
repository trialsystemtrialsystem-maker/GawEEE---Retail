import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { validate, createJournalEntrySchema } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'

// GET /api/accounting/journal-entries?outlet_id=&status=
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const outletId = searchParams.get('outlet_id') ?? auth.outlet_id
  const status = searchParams.get('status')
  if (!outletId || !canAccessOutlet(auth, outletId)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  let query = auth.supabase
    .from('journal_entries')
    .select('*')
    .eq('outlet_id', outletId)
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status as 'draft' | 'posted' | 'reversed')

  const { data, error } = await query
  if (error) {
    const { status: httpStatus, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status: httpStatus })
  }

  return NextResponse.json({ entries: data })
}

// POST /api/accounting/journal-entries — creates a draft entry with its line
// items atomically via create_journal_entry() (see 014_accounting_functions.sql).
export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const result = validate(createJournalEntrySchema, body)
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })

  if (!canAccessOutlet(auth, result.data.outlet_id)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { data, error } = await auth.supabase.rpc('create_journal_entry', {
    p_outlet_id: result.data.outlet_id,
    p_created_by: auth.id,
    p_entry_date: result.data.entry_date,
    p_description: result.data.description,
    p_lines: result.data.lines,
  })

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ journal_entry_id: data?.[0]?.journal_entry_id }, { status: 201 })
}
