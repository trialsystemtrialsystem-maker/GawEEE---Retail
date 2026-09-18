import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('login shows an error for wrong credentials', async ({ page }) => {
    await page.goto('/auth/login')
    await page.fill('input[name="email"]', 'nonexistent-user@example.com')
    await page.fill('input[name="password"]', 'WrongPassword123')
    await page.click('button[type="submit"]')

    await expect(page.locator('text=Email atau password salah')).toBeVisible()
  })

  // Mismatched-password rejection is actually server-side (signUpSchema's
  // .refine() in lib/utils/validation.ts, returned as a confirm_password
  // fieldError), not a client-side pre-check — the form has no such check of
  // its own, it just relays whatever POST /api/auth/register returns. This
  // does mean the test consumes register's IP rate limit (5/hour, see
  // todo.md Phase 5) same as signup-login-roundtrip.spec.ts; both hitting it
  // back-to-back within the same hour will 429 instead of asserting the
  // field error.
  test('signup rejects mismatched passwords (server-side validation)', async ({ page }) => {
    await page.goto('/auth/signup')
    await page.fill('input[name="company_name"]', 'Toko E2E')
    await page.fill('input[name="email"]', 'e2e-mismatch@example.com')
    await page.fill('input[name="phone"]', '081200000000')
    await page.fill('input[name="password"]', 'Password123')
    await page.fill('input[name="confirm_password"]', 'Different123')
    await page.check('input[type="checkbox"]')
    await page.click('button[type="submit"]')

    await expect(page.locator('text=Password tidak cocok')).toBeVisible()
  })

  test('landing page links to signup and login', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'Coba Gratis 14 Hari' })).toHaveAttribute(
      'href',
      '/auth/signup'
    )
    await expect(page.getByRole('link', { name: 'Masuk' })).toHaveAttribute('href', '/auth/login')
  })
})
