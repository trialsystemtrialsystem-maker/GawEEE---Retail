import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { validate, whatsappBroadcastSchema } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'

// GET /api/whatsapp/broadcasts?outlet_id=
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const outletId = request.nextUrl.searchParams.get('outlet_id') ?? auth.outlet_id
  if (!outletId || !canAccessOutlet(auth, outletId)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { data, error } = await auth.supabase
    .from('whatsapp_broadcasts')
    .select('*, whatsapp_templates(name)')
    .eq('outlet_id', outletId)
    .order('created_at', { ascending: false })

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ broadcasts: data })
}

// POST /api/whatsapp/broadcasts — creates a broadcast and immediately marks it
// 'sent' (no real WhatsApp Business API integration exists). The recipient
// count is a real number — distinct customers with a phone on file at this
// outlet — not a real send.
export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const result = validate(whatsappBroadcastSchema, body)
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })

  if (!canAccessOutlet(auth, result.data.outlet_id)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  let sentCount: number

  if (result.data.customer_group_id) {
    // Campaign targeted at a customer_groups segment (Sales > Campaign) —
    // real audience is that group's customers who have a phone on file.
    const { count } = await auth.supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('outlet_id', result.data.outlet_id)
      .eq('group_id', result.data.customer_group_id)
      .not('phone', 'is', null)
    sentCount = count ?? 0
  } else {
    const { data: customers } = await auth.supabase
      .from('invoices')
      .select('customer_phone')
      .eq('outlet_id', result.data.outlet_id)
      .not('customer_phone', 'is', null)
    sentCount = new Set((customers ?? []).map((c) => c.customer_phone)).size
  }

  const { data, error } = await auth.supabase
    .from('whatsapp_broadcasts')
    .insert({
      ...result.data,
      created_by: auth.id,
      status: 'sent',
      sent_count: sentCount,
      sent_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ broadcast: data }, { status: 201 })
}
