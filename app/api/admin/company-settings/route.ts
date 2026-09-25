import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { validate, companySettingsSchema } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'

type Settings = { max_cashier_discount_percent?: number; receipt_header?: string; receipt_footer?: string; [key: string]: unknown }

// GET/PATCH /api/admin/company-settings — master_admin only. Edits the
// business-wide settings (Master Admin > Pengaturan Sistem). tax_rate is read
// by create_invoice() (012_create_invoice_function.sql) at checkout time, so
// changing it takes effect on the very next sale; receipt text is read by the
// POS receipt via /api/receipt-settings.
export async function GET() {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (auth.role !== 'master_admin') return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })

  const { data, error } = await auth.supabase.from('companies').select('name, tax_id, tax_rate, settings').eq('id', auth.company_id).single()
  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }
  const settings = (data.settings ?? {}) as Settings
  return NextResponse.json({
    name: data.name,
    tax_id: data.tax_id,
    tax_rate: data.tax_rate ?? 10,
    receipt_header: settings.receipt_header ?? '',
    receipt_footer: settings.receipt_footer ?? '',
    max_cashier_discount_percent: typeof settings.max_cashier_discount_percent === 'number' ? settings.max_cashier_discount_percent : 30,
  })
}

export async function PATCH(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (auth.role !== 'master_admin') return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })

  const result = validate(companySettingsSchema, await request.json())
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })
  const { name, tax_id, tax_rate, receipt_header, receipt_footer, max_cashier_discount_percent } = result.data

  // Merge into the existing settings jsonb rather than replacing it, so other
  // keys (permissions, features — later Phase 32 batches) are never clobbered.
  const { data: current } = await auth.supabase.from('companies').select('settings').eq('id', auth.company_id).single()
  const settings: Settings = { ...((current?.settings ?? {}) as Settings), receipt_header: receipt_header ?? '', receipt_footer: receipt_footer ?? '' }
  if (max_cashier_discount_percent !== undefined) settings.max_cashier_discount_percent = max_cashier_discount_percent

  const { error } = await auth.supabase
    .from('companies')
    .update({ name, tax_id: tax_id || null, tax_rate, settings })
    .eq('id', auth.company_id)
  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  await auth.supabase.from('audit_log').insert({
    user_id: auth.authUserId,
    company_id: auth.company_id,
    action_type: 'UPDATE',
    entity_type: 'company_settings',
    entity_id: auth.company_id,
    new_values: { name, tax_id, tax_rate, receipt_header, receipt_footer, max_cashier_discount_percent },
    status: 'success',
  })

  return NextResponse.json({ ok: true })
}
