import { redirect } from 'next/navigation'

// User management already lives at /dashboard/admin/users (master_admin
// only, matching where the API is gated) — redirect rather than duplicate it.
export default function SettingsUsersRedirect() {
  redirect('/dashboard/admin/users')
}
