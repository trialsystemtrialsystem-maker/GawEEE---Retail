import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PosPortalNav } from '@/components/pos/PosPortalNav'

export default async function POSLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('users').select('full_name, outlet_id').eq('id', user.id).single()
  const outlet = profile?.outlet_id
    ? (await supabase.from('outlets').select('name').eq('id', profile.outlet_id).single()).data
    : null

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="bg-gradient-to-r from-emerald-800 to-emerald-600 px-4 py-2.5 sm:px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-lg font-extrabold text-white">GawEEE.com</span>
            <span className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold text-white">Mode Kasir</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/25"
            >
              <span aria-hidden>▦</span> Menu Lengkap
            </Link>
            <span
              aria-hidden
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-xs font-bold text-white"
              title={profile?.full_name ?? 'Kasir'}
            >
              {(profile?.full_name ?? '?').charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
      </div>
      <div className="border-b border-gray-200 bg-white">
        <PosPortalNav />
      </div>
      <div className="p-4 sm:p-6">
        {outlet?.name && <p className="mb-3 hidden text-xs text-gray-400 sm:block">{outlet.name}</p>}
        {children}
      </div>
    </div>
  )
}
