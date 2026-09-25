import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext } from '@/lib/utils/auth-context'
import { validate } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'

const schema = z.object({
  enabled: z.boolean(),
  rate_percent: z.number().min(0).max(100),
  threshold: z.number().min(0).max(1e12),
})

// PATCH /api/admin/tax-settings — master_admin only; merges the PPh Final
// settings into companies.settings.tax without touching other keys.
export async function PATCH(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (auth.role !== 'master_admin') return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })

  const result = validate(schema, await request.json())
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })

  const { data: current } = await auth.supabase.from('companies').select('settings').eq('id', auth.company_id).single()
  const settings = (current?.settings ?? {}) as Record<string, unknown>
  const { error } = await auth.supabase
    .from('companies')
    .update({ settings: { ...settings, tax: { ...((settings.tax as object) ?? {}), ...result.data } } })
    .eq('id', auth.company_id)
  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  await auth.supabase.from('audit_log').insert({
    user_id: auth.authUserId,
    company_id: auth.company_id,
    action_type: 'UPDATE',
    entity_type: 'tax_settings',
    entity_id: auth.company_id,
    new_values: result.data,
    status: 'success',
  })
  return NextResponse.json({ ok: true })
}
