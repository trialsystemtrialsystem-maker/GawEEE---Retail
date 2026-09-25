import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { validate, couponSchema } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'

const MANAGERS = ['outlet_manager', 'master_admin']

// PATCH /api/coupons/:id { is_active } — quick on/off toggle.
export async function PATCH(request: NextRequest, ctx: RouteContext<'/api/coupons/[id]'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!MANAGERS.includes(auth.role)) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  const { id } = await ctx.params
  const body = await request.json()
  if (typeof body.is_active !== 'boolean') return NextResponse.json({ error: 'is_active wajib diisi' }, { status: 400 })
  const { data, error } = await auth.supabase.from('coupons').update({ is_active: body.is_active }).eq('id', id).select().single()
  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }
  return NextResponse.json({ coupon: data })
}

// PUT /api/coupons/:id — edit terms. usage_count is never writable here, and
// the limit cannot be lowered below what has already been used.
export async function PUT(request: NextRequest, ctx: RouteContext<'/api/coupons/[id]'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!MANAGERS.includes(auth.role)) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  const { id } = await ctx.params
  const result = validate(couponSchema, await request.json())
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })

  const { data: existing } = await auth.supabase.from('coupons').select('outlet_id, usage_count').eq('id', id).maybeSingle()
  if (!existing || existing.outlet_id !== result.data.outlet_id || !canAccessOutlet(auth, existing.outlet_id)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }
  if (result.data.usage_limit != null && result.data.usage_limit < existing.usage_count) {
    return NextResponse.json({ error: `Batas pemakaian tidak boleh di bawah pemakaian saat ini (${existing.usage_count})` }, { status: 400 })
  }

  const { data, error } = await auth.supabase
    .from('coupons')
    .update({ ...result.data, code: result.data.code.trim().toUpperCase() })
    .eq('id', id)
    .select()
    .single()
  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }
  return NextResponse.json({ coupon: data })
}
