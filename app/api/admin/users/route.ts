import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext } from '@/lib/utils/auth-context'
import { createAdminClient } from '@/lib/supabase/server'
import { validate } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'
import { selectAll } from '@/lib/utils/fetchAll'

// GET /api/admin/users — master_admin only. Lists every user of the company
// (active and deactivated). Filters: outlet_id, role, status, search (name/email).
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (auth.role !== 'master_admin') {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { searchParams } = request.nextUrl
  const outletId = searchParams.get('outlet_id')
  const role = searchParams.get('role')
  const status = searchParams.get('status')
  const search = searchParams.get('search')?.trim().replace(/[%,()]/g, '')

  let query = auth.supabase
    .from('users')
    .select('id, email, full_name, phone, role, status, outlet_id, last_login_at, created_at, outlets!users_outlet_id_fkey(name)')
    .eq('company_id', auth.company_id)
    .order('full_name')

  if (outletId) query = query.eq('outlet_id', outletId)
  if (role) query = query.eq('role', role as 'master_admin' | 'outlet_manager' | 'cashier' | 'staff')
  if (status === 'active' || status === 'inactive') query = query.eq('status', status)
  if (search) query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)

  const { data, error } = await selectAll(query)
  if (error) {
    const { status: s, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status: s })
  }

  return NextResponse.json({
    users: (data ?? []).map((u) => ({
      user_id: u.id,
      email: u.email,
      full_name: u.full_name,
      phone: u.phone,
      role: u.role,
      outlet_id: u.outlet_id,
      outlet_name: (u as unknown as { outlets: { name: string } | null }).outlets?.name ?? null,
      status: u.status,
      last_login: u.last_login_at,
      created_at: u.created_at,
    })),
  })
}

const inviteSchema = z.object({
  email: z.string().trim().email('Email tidak valid').max(255),
  full_name: z.string().trim().min(1, 'Nama wajib diisi').max(255),
  phone: z.string().trim().max(20).optional(),
  role: z.enum(['outlet_manager', 'cashier', 'staff']),
  // Every role except the owner works inside one outlet; without it the account
  // could sign in but no page would open for it.
  outlet_id: z.string().uuid('Pilih outlet untuk pengguna ini'),
})

// POST /api/admin/users — create a user of the company. See prd.md §4.7.
// Creates the auth user via the admin API (auto-confirmed) with a one-time
// temporary password and links it to a `users` row with the role and outlet.
export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (auth.role !== 'master_admin') {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const result = validate(inviteSchema, await request.json())
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })
  const { email, full_name, phone, role, outlet_id } = result.data

  const { data: outlet } = await auth.supabase.from('outlets').select('id').eq('id', outlet_id).eq('company_id', auth.company_id).maybeSingle()
  if (!outlet) return NextResponse.json({ error: 'Outlet tidak ditemukan' }, { status: 400 })

  const admin = createAdminClient()
  const tempPassword = `${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}Aa1`

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  })

  if (createError || !created.user) {
    return NextResponse.json({ error: createError?.message ?? 'Gagal membuat pengguna' }, { status: 400 })
  }

  const { error: insertError } = await admin.from('users').insert({
    id: created.user.id,
    company_id: auth.company_id,
    outlet_id,
    email,
    full_name,
    phone,
    role,
  })

  if (insertError) {
    await admin.auth.admin.deleteUser(created.user.id).catch(() => {})
    const { status, message } = handleDatabaseError(insertError)
    return NextResponse.json({ error: message }, { status })
  }

  await auth.supabase.from('audit_log').insert({
    user_id: auth.authUserId,
    company_id: auth.company_id,
    outlet_id,
    action_type: 'CREATE',
    entity_type: 'user',
    entity_id: created.user.id,
    new_values: { email, full_name, role, outlet_id },
    status: 'success',
  })

  return NextResponse.json({ user_id: created.user.id, email, temp_password: tempPassword }, { status: 201 })
}
