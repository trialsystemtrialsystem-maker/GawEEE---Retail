import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'

export const metadata = { title: 'Pengaturan Awal | GawEEE' }

export default async function OnboardingPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role, outlet_id, company_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'master_admin' || !profile.outlet_id) {
    redirect('/dashboard')
  }

  const { data: company } = await supabase
    .from('companies')
    .select('onboarding_completed_at')
    .eq('id', profile.company_id)
    .single()
  if (company?.onboarding_completed_at) redirect('/dashboard')

  const { data: outlet } = await supabase
    .from('outlets')
    .select('id, name, address, city, phone, opening_cash, enabled_payment_methods')
    .eq('id', profile.outlet_id)
    .single()

  if (!outlet) redirect('/dashboard')

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-2xl space-y-8 rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Selamat Datang di GawEEE</h1>
          <p className="mt-2 text-gray-600">Beberapa langkah singkat sebelum mulai jualan.</p>
        </div>
        <OnboardingWizard outlet={outlet} />
      </div>
    </div>
  )
}
