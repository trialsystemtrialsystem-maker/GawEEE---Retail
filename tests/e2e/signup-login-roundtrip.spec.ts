import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

// Full successful signup -> login round trip — see todo.md Phase 1's
// "Integration tests: login/signup flow" item. The error/validation paths
// (wrong credentials, mismatched passwords) already have real E2E coverage
// in auth.spec.ts; what was missing was the happy path, deliberately held
// back because it creates a real Supabase Auth user and there's no separate
// throwaway/sandbox project (see roadmap.md Phase 5's "Local dev database"
// note, same underlying constraint). Resolved here with a teardown step
// instead of a new project: the test provisions one throwaway company via
// the real signup flow and deletes it (auth user + company + outlet)
// afterward via the service-role admin client, regardless of pass/fail.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

test.describe('Signup -> login round trip', () => {
  test.skip(!supabaseUrl || !serviceRoleKey, 'NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not set')

  let cleanup: { userId: string; companyId: string; outletId: string } | null = null

  test.afterEach(async () => {
    if (!cleanup) return
    const admin = createClient(supabaseUrl, serviceRoleKey)
    await admin.from('outlets').delete().eq('id', cleanup.outletId)
    await admin.from('companies').delete().eq('id', cleanup.companyId)
    await admin.auth.admin.deleteUser(cleanup.userId).catch(() => {})
    cleanup = null
  })

  test('signing up provisions a real account that can immediately log in and reach onboarding', async ({ page }) => {
    const uniqueEmail = `e2e-roundtrip-${Date.now()}@example.com`
    const password = 'Password123'

    await page.goto('/auth/signup')
    await page.fill('input[name="company_name"]', 'Toko E2E Roundtrip')
    await page.fill('input[name="email"]', uniqueEmail)
    await page.fill('input[name="phone"]', '081200000001')
    await page.fill('input[name="password"]', password)
    await page.fill('input[name="confirm_password"]', password)
    await page.check('input[type="checkbox"]')

    const [registerResp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/auth/register') && r.request().method() === 'POST'),
      page.click('button[type="submit"]'),
    ])
    expect(registerResp.status()).toBe(201)
    const registered = await registerResp.json()
    cleanup = { userId: registered.user_id, companyId: registered.company_id, outletId: registered.outlet_id }

    await expect(page).toHaveURL(/\/auth\/verify-email/)

    // signUp() already leaves the browser with an authenticated session
    // (email confirmation is disabled — no SMTP configured, see todo.md
    // Phase 0), so /auth/login would just redirect straight past the login
    // form via middleware without it. Log out first (same call the "Keluar"
    // button makes) to actually exercise the login code path, not just ride
    // signup's own session.
    await page.evaluate(() => fetch('/api/auth/logout', { method: 'POST' }))
    await page.goto('/auth/login')
    await page.fill('input[name="email"]', uniqueEmail)
    await page.fill('input[name="password"]', password)
    await page.click('button[type="submit"]')

    // A brand-new company's owner lands in the onboarding wizard, not the
    // main dashboard (see todo.md Phase 1's onboarding-flow entry).
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 15000 })

    const me = await page.evaluate(() => fetch('/api/auth/me').then((r) => r.json()))
    expect(me.user.role).toBe('master_admin')
    expect(me.company.name).toBe('Toko E2E Roundtrip')
    expect(me.outlet).toBeTruthy()
  })
})
