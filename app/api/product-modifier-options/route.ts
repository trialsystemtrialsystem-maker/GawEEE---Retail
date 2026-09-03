import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { validate, productModifierOptionSchema } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'

// POST /api/product-modifier-options — manager+ only.
export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['outlet_manager', 'master_admin'].includes(auth.role)) {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const body = await request.json()
  const result = validate(productModifierOptionSchema, body)
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })

  const { data, error } = await auth.supabase.from('product_modifier_options').insert(result.data).select().single()
  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({ option: data }, { status: 201 })
}
