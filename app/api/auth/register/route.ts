import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { validate, signUpSchema } from '@/lib/utils/validation'

// POST /api/auth/register — see prd.md §4.1
export async function POST(request: NextRequest) {
  const body = await request.json()
  const result = validate(signUpSchema, body)
  if (!result.valid) {
    return NextResponse.json({ error: result.errors }, { status: 400 })
  }
  const { company_name, email, password, phone, industry, outlet_count } = result.data

  const supabase = await createClient()
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: company_name } },
  })

  if (signUpError) {
    const status = signUpError.status === 422 ? 409 : 400
    return NextResponse.json({ error: signUpError.message }, { status })
  }

  const authUser = signUpData.user
  if (!authUser) {
    return NextResponse.json({ error: 'Gagal membuat akun' }, { status: 500 })
  }

  // Provision company + outlet + owner row atomically via a SECURITY DEFINER
  // RPC (see database/migrations/011_register_function.sql) — the new auth
  // user has no session until they confirm their email, so a plain
  // RLS-scoped insert would be rejected.
  const admin = createAdminClient()
  const { data: provisioned, error: provisionError } = await admin
    .rpc('provision_company_and_owner', {
      p_user_id: authUser.id,
      p_email: email,
      p_full_name: company_name,
      p_phone: phone,
      p_company_name: company_name,
      p_tier: outlet_count === 'multi' ? 'professional' : 'starter',
      p_industry: industry,
    })
    .single()

  if (provisionError) {
    // Roll back the orphaned auth user so a retry with the same email works.
    await admin.auth.admin.deleteUser(authUser.id).catch(() => {})
    return NextResponse.json({ error: provisionError.message }, { status: 500 })
  }

  const { company_id, outlet_id } = provisioned as { company_id: string; outlet_id: string }

  return NextResponse.json(
    {
      company_id,
      outlet_id,
      user_id: authUser.id,
      needs_email_verification: !signUpData.session,
    },
    { status: 201 }
  )
}
