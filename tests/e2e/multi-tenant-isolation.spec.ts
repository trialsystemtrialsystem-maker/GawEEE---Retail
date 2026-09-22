import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { login, createCashSale, voidNow } from './helpers'

// Regression coverage for the single most fundamental guarantee of a
// multi-tenant SaaS (prd.md §2.3 "Multi-Tenancy & Security Model"): a user
// from one company can never read another company's data, even by
// requesting a known id directly — and despite that guarantee being the
// whole reason RLS exists here, nothing in this codebase's test suite
// actually exercised it before this file.
const MANAGER_EMAIL = process.env.E2E_TEST_EMAIL || 'demo@gaweee.app'
const MANAGER_PASSWORD = process.env.E2E_TEST_PASSWORD || 'DemoGawEEE2026!'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

test.describe('Multi-tenant isolation (RLS)', () => {
  test.setTimeout(60_000)
  test.skip(!SUPABASE_URL || !SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY not available in this environment')

  test('a freshly provisioned company cannot read another company\'s invoice or product by id', async ({ page }) => {
    // Create a real invoice + note its product in the existing demo company.
    await login(page, MANAGER_EMAIL, MANAGER_PASSWORD)
    const invoiceId = await createCashSale(page)
    const invoiceDetail = await page.evaluate(async (id) => (await fetch(`/api/invoices/${id}`)).json(), invoiceId)
    const productId = invoiceDetail.items[0].product_id as string

    // Provision a completely separate company + owner directly via the same
    // SECURITY DEFINER RPC app/api/auth/register/route.ts uses
    // (database/migrations/011_register_function.sql) — calling it straight
    // from here, with the service-role key, bypasses the HTTP route entirely
    // and so doesn't touch its 5/hour IP rate limit, which this suite's
    // other specs (auth.spec.ts, signup-login-roundtrip.spec.ts) already
    // share a budget with.
    const admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!)
    const email = `e2e-isolation-${Date.now()}@gaweee.test`
    const password = `Isolation${Date.now()}!`

    const { data: created, error: createErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    if (createErr || !created.user) throw new Error(`E2E setup: failed to create isolated auth user — ${createErr?.message}`)

    const { data: provisioned, error: provisionErr } = await admin
      .rpc('provision_company_and_owner', {
        p_user_id: created.user.id,
        p_email: email,
        p_full_name: 'E2E Isolation Owner',
        p_phone: '081200000099',
        p_company_name: `E2E Isolation Co ${Date.now()}`,
        p_tier: 'starter',
        p_industry: 'other',
      })
      .single()

    if (provisionErr || !provisioned) {
      await admin.auth.admin.deleteUser(created.user.id).catch(() => {})
      throw new Error(`E2E setup: failed to provision isolated company — ${provisionErr?.message}`)
    }
    const { company_id: isolatedCompanyId } = provisioned as { company_id: string; outlet_id: string }

    try {
      await login(page, email, password)

      const invoiceRes = await page.evaluate(async (id) => {
        const res = await fetch(`/api/invoices/${id}`)
        return { status: res.status, body: await res.json() }
      }, invoiceId)
      expect(invoiceRes.status).toBe(404)
      expect(JSON.stringify(invoiceRes.body)).not.toContain(invoiceId)

      const productRes = await page.evaluate(async (id) => {
        const res = await fetch(`/api/products/${id}`)
        return { status: res.status, body: await res.json() }
      }, productId)
      expect(productRes.status).toBe(404)

      // The list endpoints must also come back empty for the isolated
      // company, not silently include the demo company's rows.
      const listRes = await page.evaluate(async () => {
        const res = await fetch('/api/outlets')
        return res.json()
      })
      expect(listRes.outlets).toHaveLength(1) // just its own freshly-provisioned outlet
    } finally {
      // Cleanup — remove the isolated fixture company/user entirely, then
      // void the demo invoice so repeated runs don't leave junk behind.
      await admin.from('users').delete().eq('company_id', isolatedCompanyId)
      await admin.from('outlets').delete().eq('company_id', isolatedCompanyId)
      await admin.from('companies').delete().eq('id', isolatedCompanyId)
      await admin.auth.admin.deleteUser(created.user.id).catch(() => {})

      await login(page, MANAGER_EMAIL, MANAGER_PASSWORD)
      await voidNow(page, invoiceId, 'Pembersihan data uji regresi otomatis')
    }
  })
})
