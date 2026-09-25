import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { validate, promotionSchema } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'

// PATCH /api/promotions/:id { is_active } — manager+ only. Quick on/off toggle.
export async function PATCH(request: NextRequest, ctx: RouteContext<'/api/promotions/[id]'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['outlet_manager', 'master_admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { id } = await ctx.params
  const body = await request.json()
  if (typeof body.is_active !== 'boolean') {
    return NextResponse.json({ error: 'is_active wajib diisi' }, { status: 400 })
  }

  const { data, error } = await auth.supabase.from('promotions').update({ is_active: body.is_active }).eq('id', id).select().single()

  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ promotion: data })
}

// PUT /api/promotions/:id — edit the terms (same schema as create). Past
// applications keep the discount they were granted; only future checkouts
// see the new terms.
export async function PUT(request: NextRequest, ctx: RouteContext<'/api/promotions/[id]'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['outlet_manager', 'master_admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }
  const { id } = await ctx.params
  const result = validate(promotionSchema, await request.json())
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })

  const { data: existing } = await auth.supabase.from('promotions').select('outlet_id').eq('id', id).maybeSingle()
  if (!existing || existing.outlet_id !== result.data.outlet_id || !canAccessOutlet(auth, existing.outlet_id)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { data, error } = await auth.supabase.from('promotions').update(result.data).eq('id', id).select().single()
  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }
  return NextResponse.json({ promotion: data })
}
