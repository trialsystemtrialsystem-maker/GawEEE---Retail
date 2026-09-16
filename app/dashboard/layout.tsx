import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardShell } from '@/components/layout/DashboardShell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  // getSession() not getUser(): proxy.ts's middleware already verified this
  // request's session over the network before it reached this layout (see
  // the comment on getAuthContext() for the full reasoning) — re-verifying
  // here would just add another ~1-1.5s round trip for nothing.
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user

  if (!user) {
    redirect('/auth/login')
  }

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, outlet_id, role, company_id')
    .eq('id', user.id)
    .single()

  // First-time setup: a master_admin whose company hasn't finished the
  // onboarding wizard yet gets sent there instead of the dashboard. Staff
  // accounts (invited by the owner, or a cashier) never see this — only the
  // owner who's meant to configure the outlet.
  if (profile?.role === 'master_admin' && profile.company_id) {
    const { data: company } = await supabase
      .from('companies')
      .select('onboarding_completed_at')
      .eq('id', profile.company_id)
      .single()
    if (company && !company.onboarding_completed_at) {
      redirect('/onboarding')
    }
  }

  const outlet = profile?.outlet_id
    ? (await supabase.from('outlets').select('name').eq('id', profile.outlet_id).single()).data
    : null

  return (
    <DashboardShell
      userName={profile?.full_name ?? undefined}
      outletName={outlet?.name ?? undefined}
      outletId={profile?.outlet_id ?? undefined}
    >
      {children}
    </DashboardShell>
  )
}
