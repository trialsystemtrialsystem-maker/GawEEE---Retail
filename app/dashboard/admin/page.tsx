import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Alert } from '@/components/ui/Alert'
import { ADMIN_HUB_SECTIONS } from '@/lib/nav/adminHub'

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  const { data: profile } = await supabase.from('users').select('role').eq('id', user!.id).single()

  if (profile?.role !== 'master_admin') {
    return <Alert variant="danger">Halaman ini khusus untuk Master Admin.</Alert>
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Master Admin</h1>
        <p className="text-gray-500">Pusat kendali sistem — atur, ubah, tambah, dan sesuaikan seluruh sistem sesuai kebutuhan bisnis Anda.</p>
      </div>

      {ADMIN_HUB_SECTIONS.map((section) => (
        <section key={section.title} className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">{section.title}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {section.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-blue-300 hover:bg-brand-50"
              >
                <span className="text-2xl" aria-hidden>{item.icon}</span>
                <span>
                  <span className="block font-medium text-gray-900">{item.label}</span>
                  <span className="block text-sm text-gray-500">{item.description}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
