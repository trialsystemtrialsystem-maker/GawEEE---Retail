import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { validate, whatsappBroadcastSchema } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'
import { renderTemplate, unknownPlaceholders } from '@/lib/utils/whatsappTemplate'
import { resolveAudience } from '@/lib/server/whatsappAudience'
import { formatCurrency, formatDate } from '@/lib/utils/formatting'

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

// POST /api/whatsapp/broadcasts — builds a personalised send QUEUE (there is no
// WhatsApp Business API integration, so nothing is sent from here). Each
// recipient gets the template rendered with their own details and a click-to-send
// link in the UI; the operator marks them sent/skipped, and only then does
// sent_count grow. Customers who opted out are excluded.
export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const result = validate(whatsappBroadcastSchema, body)
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })
  const { audience, ...input } = result.data

  if (!canAccessOutlet(auth, input.outlet_id)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { data: template } = await auth.supabase.from('whatsapp_templates').select('content').eq('id', input.template_id).eq('outlet_id', input.outlet_id).single()
  if (!template) return NextResponse.json({ error: 'Template tidak ditemukan' }, { status: 404 })
  const unknown = unknownPlaceholders(template.content)
  if (unknown.length > 0) return NextResponse.json({ error: `Template memakai placeholder yang tidak dikenal: ${unknown.map((u) => '{' + u + '}').join(', ')}. Yang tersedia: {nama}, {toko}, {invoice}, {total}, {tanggal}` }, { status: 400 })

  const effective = audience ?? (input.customer_group_id ? ({ type: 'group', group_id: input.customer_group_id } as const) : ({ type: 'recent_buyers', days: 365 } as const))
  const { recipients, opted_out, capped } = await resolveAudience(auth, input.outlet_id, effective)
  if (recipients.length === 0) return NextResponse.json({ error: 'Tidak ada penerima yang cocok (semua kosong atau sudah berhenti berlangganan)' }, { status: 400 })

  const { data: outlet } = await auth.supabase.from('outlets').select('name').eq('id', input.outlet_id).single()
  const { data: broadcast, error } = await auth.supabase
    .from('whatsapp_broadcasts')
    .insert({ outlet_id: input.outlet_id, template_id: input.template_id, target_note: input.target_note, customer_group_id: input.customer_group_id, created_by: auth.id, status: 'draft', sent_count: 0 })
    .select()
    .single()
  if (error || !broadcast) {
    const { status, message } = handleDatabaseError(error ?? { message: 'Gagal membuat broadcast' })
    return NextResponse.json({ error: message }, { status })
  }

  const rows = recipients.map((r) => ({
    broadcast_id: broadcast.id,
    outlet_id: input.outlet_id,
    customer_id: r.customer_id,
    name: r.name,
    phone: r.phone,
    message: renderTemplate(template.content, {
      nama: r.name,
      toko: outlet?.name ?? '',
      invoice: r.last_invoice ?? undefined,
      total: r.last_total !== null ? formatCurrency(r.last_total) : undefined,
      tanggal: r.last_at ? formatDate(r.last_at) : undefined,
    }),
  }))
  for (let i = 0; i < rows.length; i += 200) {
    const { error: insertError } = await auth.supabase.from('whatsapp_broadcast_recipients').insert(rows.slice(i, i + 200))
    if (insertError) {
      await auth.supabase.from('whatsapp_broadcasts').delete().eq('id', broadcast.id)
      const { status, message } = handleDatabaseError(insertError)
      return NextResponse.json({ error: message }, { status })
    }
  }

  return NextResponse.json({ broadcast, recipients: rows.length, opted_out_excluded: opted_out, capped }, { status: 201 })
}
