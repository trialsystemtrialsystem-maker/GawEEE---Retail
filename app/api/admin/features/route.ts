import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext } from '@/lib/utils/auth-context'
import { validate } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'
import { FEATURES } from '@/lib/nav/features'

const schema = z.object({ key: z.string().refine((k) => FEATURES.some((f) => f.key === k), 'Fitur tidak dikenal'), enabled: z.boolean() })

// PATCH /api/admin/features { key, enabled } — master_admin only. Merges into
// companies.settings.features without touching other settings keys.
export async function PATCH(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (auth.role !== 'master_admin') return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })

  const result = validate(schema, await request.json())
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })
  const { key, enabled } = result.data

  const { data: current } = await auth.supabase.from('companies').select('settings').eq('id', auth.company_id).single()
  const settings = (current?.settings ?? {}) as { features?: Record<string, boolean>; [k: string]: unknown }
  const features = { ...(settings.features ?? {}), [key]: enabled }

  const { error } = await auth.supabase
    .from('companies')
    .update({ settings: { ...settings, features } })
    .eq('id', auth.company_id)
  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  await auth.supabase.from('audit_log').insert({
    user_id: auth.authUserId,
    company_id: auth.company_id,
    action_type: 'UPDATE',
    entity_type: 'company_features',
    entity_id: auth.company_id,
    new_values: { key, enabled },
    status: 'success',
  })

  return NextResponse.json({ features })
}
