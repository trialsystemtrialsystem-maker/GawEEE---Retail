import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/utils/auth-context'
import { createAdminClient } from '@/lib/supabase/server'
import { handleDatabaseError } from '@/lib/utils/errors'

// GET /api/admin/users — master_admin only. See prd.md §4.7.
export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (auth.role !== 'master_admin') {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const { searchParams } = request.nextUrl
  const outletId = searchParams.get('outlet_id')
  const role = searchParams.get('role')
  const search = searchParams.get('search')

  let query = auth.supabase
    .from('users')
    .select('id, email, full_name, role, status, last_login_at, outlets(name)')
    .eq('company_id', auth.company_id)

  if (outletId) query = query.eq('outlet_id', outletId)
  if (role) query = query.eq('role', role as 'master_admin' | 'outlet_manager' | 'cashier' | 'staff')
  if (search) query = query.ilike('full_name', `%${search}%`)

  const { data, error } = await query
  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({
    users: (data ?? []).map((u) => ({
      user_id: u.id,
      email: u.email,
      full_name: u.full_name,
      role: u.role,
      outlet_name: (u as unknown as { outlets: { name: string } | null }).outlets?.name ?? null,
      status: u.status,
      last_login: u.last_login_at,
    })),
  })
}

// POST /api/admin/users — invite a new user to the company. See prd.md §4.7.
// Creates the auth user via the admin API (auto-confirmed + invited by email)
// and links it to a `users` row with the given role/outlet.
export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (auth.role !== 'master_admin') {
    return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  }

  const body = await request.json()
  const { email, full_name, phone, role, outlet_id } = body as {
    email: string
    full_name: string
    phone?: string
    role: 'outlet_manager' | 'cashier' | 'staff'
    outlet_id?: string
  }

  if (!email || !full_name || !role) {
    return NextResponse.json({ error: 'email, full_name, role wajib diisi' }, { status: 400 })
  }

  const admin = createAdminClient()
  const tempPassword = crypto.randomUUID().slice(0, 12)

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
    outlet_id: outlet_id ?? null,
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

  return NextResponse.json({ user_id: created.user.id, email, temp_password: tempPassword }, { status: 201 })
}
