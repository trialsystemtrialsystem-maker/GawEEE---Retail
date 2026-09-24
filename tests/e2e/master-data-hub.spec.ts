import { test, expect } from '@playwright/test'
import { login } from './helpers'

// Master Admin > Data Master (todo.md Phase 32 batch 5): every card on the hub
// must lead to a page that exists.
test('every Data Master card links to a working page', async ({ page }) => {
  test.setTimeout(240_000)
  await login(page, process.env.E2E_TEST_EMAIL || 'demo@gaweee.app', process.env.E2E_TEST_PASSWORD || 'DemoGawEEE2026!')
  await page.goto('/dashboard/admin/master-data')
  await expect(page.getByRole('heading', { name: 'Data Master' })).toBeVisible({ timeout: 30_000 })
  const hrefs = await page.locator('a[href^="/dashboard"]').evaluateAll((els) => Array.from(new Set(els.map((e) => e.getAttribute('href') as string))))
  expect(hrefs.length).toBeGreaterThan(10)
  // Master Admin is a closed configuration space: no link may leave it.
  expect(hrefs.filter((h) => h !== '/dashboard' && !h.startsWith('/dashboard/admin'))).toEqual([])
  await expect(page.getByText('Mode Konfigurasi')).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Navigasi modul' })).toHaveCount(0)
  for (const href of hrefs) {
    const res = await page.request.get(href)
    expect(res.status(), href).toBeLessThan(400)
  }
})
