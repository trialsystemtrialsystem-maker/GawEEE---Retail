import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext, canAccessOutlet } from '@/lib/utils/auth-context'
import { can } from '@/lib/utils/permissions'
import { validate } from '@/lib/utils/validation'
import { handleDatabaseError } from '@/lib/utils/errors'

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const schema = z.object({
  doc_type: z.enum(['ktp', 'npwp', 'bpjs', 'kontrak', 'ijazah', 'sertifikat', 'surat_peringatan', 'lainnya']),
  title: z.string().trim().min(2, 'Judul wajib diisi').max(200),
  doc_number: z.string().trim().max(100).optional(),
  issued_on: date.optional(),
  expires_on: date.optional(),
  file_url: z.string().trim().url('Tautan berkas tidak valid').max(500).optional(),
  notes: z.string().trim().max(500).optional(),
})

async function loadStaff(auth: NonNullable<Awaited<ReturnType<typeof getAuthContext>>>, id: string) {
  const { data } = await auth.supabase.from('staff_members').select('id, outlet_id').eq('id', id).single()
  return data && canAccessOutlet(auth, data.outlet_id) ? data : null
}

// POST /api/staff/:id/documents — register an employee document (KTP, NPWP,
// BPJS, kontrak, sertifikat…). The file itself lives wherever the owner keeps
// it (a link); the record tracks number and expiry so renewals aren't missed.
export async function POST(request: NextRequest, ctx: RouteContext<'/api/staff/[id]/documents'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await can(auth, 'payroll.manage'))) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  const { id } = await ctx.params
  const staff = await loadStaff(auth, id)
  if (!staff) return NextResponse.json({ error: 'Karyawan tidak ditemukan' }, { status: 404 })

  const result = validate(schema, await request.json())
  if (!result.valid) return NextResponse.json({ error: result.errors }, { status: 400 })

  const { data, error } = await auth.supabase.from('employee_documents').insert({ ...result.data, outlet_id: staff.outlet_id, staff_id: id, created_by: auth.id }).select().single()
  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }
  return NextResponse.json({ document: data }, { status: 201 })
}

// DELETE /api/staff/:id/documents?document_id=
export async function DELETE(request: NextRequest, ctx: RouteContext<'/api/staff/[id]/documents'>) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await can(auth, 'payroll.manage'))) return NextResponse.json({ error: 'Tidak memiliki izin' }, { status: 403 })
  const { id } = await ctx.params
  const staff = await loadStaff(auth, id)
  if (!staff) return NextResponse.json({ error: 'Karyawan tidak ditemukan' }, { status: 404 })
  const documentId = request.nextUrl.searchParams.get('document_id')
  if (!documentId) return NextResponse.json({ error: 'document_id wajib diisi' }, { status: 400 })

  const { error } = await auth.supabase.from('employee_documents').delete().eq('id', documentId).eq('staff_id', id)
  if (error) {
    const { status, message } = handleDatabaseError(error)
    return NextResponse.json({ error: message }, { status })
  }
  return NextResponse.json({ ok: true })
}
