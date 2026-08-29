import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/types/database.types'

// Server-side Supabase client (Server Components, Route Handlers, Server
// Actions). Uses the anon key + the caller's session cookie, so RLS still
// applies — this is NOT a service-role/admin client.
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Called from a Server Component that can't set cookies (no
            // active response, e.g. during static rendering). Safe to
            // ignore as long as middleware.ts refreshes the session.
          }
        },
      },
    }
  )
}

// Admin client (service-role key): bypasses RLS. Only ever import this from
// trusted server code (webhooks, scheduled jobs, admin-only route handlers) —
// never expose it to the client bundle.
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
