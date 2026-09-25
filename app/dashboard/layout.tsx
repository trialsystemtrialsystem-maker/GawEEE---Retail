import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { resolveActiveOutletId } from '@/lib/server/activeOutlet'

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

  // An owner is not tied to one outlet: give the shell (and the notification
  // bell) their chosen/default outlet, and the list for the header switcher.
  const activeOutletId = profile ? await resolveActiveOutletId(supabase, { outlet_id: profile.outlet_id, role: profile.role }) : null
  const outlet = activeOutletId ? (await supabase.from('outlets').select('name').eq('id', activeOutletId).single()).data : null
  const switchable = profile?.role === 'master_admin' ? (await supabase.from('outlets').select('id, name').order('name')).data ?? [] : []

  return (
    <DashboardShell
      userName={profile?.full_name ?? undefined}
      outletName={outlet?.name ?? undefined}
      outletId={activeOutletId ?? undefined}
      switchableOutlets={switchable}
    >
      {children}
    </DashboardShell>
  )
}
