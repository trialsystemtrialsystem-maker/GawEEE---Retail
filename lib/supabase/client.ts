'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/types/database.types'

// Client-side Supabase client, for use inside Client Components / hooks.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
