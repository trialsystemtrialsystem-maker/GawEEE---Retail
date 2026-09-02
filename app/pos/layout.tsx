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
      <div className="bg-gradient-to-r from-[var(--brand-900)] to-[var(--brand-700)]">
        <div className="flex items-center justify-between px-4 pt-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-sm font-medium text-white/70 hover:text-white">
              ← Dashboard
            </Link>
            <span className="hidden text-sm text-white/50 sm:inline">|</span>
            <span className="hidden text-sm font-semibold text-white sm:inline">{outlet?.name ?? 'GawEEE POS'}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-white">
            <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-xs font-bold">
              {(profile?.full_name ?? '?').charAt(0).toUpperCase()}
            </span>
            <span className="hidden sm:inline">{profile?.full_name ?? 'Kasir'}</span>
          </div>
        </div>
        <PosPortalNav />
      </div>
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  )
}
