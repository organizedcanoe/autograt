import { expect, test } from '@playwright/test'
import { ADMIN_USERNAME, PASSWORD, logIn, logOut, openMenuItem } from './helpers.ts'

test('admin closes registration, which hides it from the login page until reopened', async ({ page, request }) => {
  await logIn(page, ADMIN_USERNAME)
  await openMenuItem(page, ADMIN_USERNAME, 'Admin')
  const toggle = page.getByRole('switch', { name: 'Open registration' })
  await expect(toggle).toBeChecked()
  await toggle.click()
  await expect(toggle).not.toBeChecked()
  await logOut(page, ADMIN_USERNAME)

  await expect(page.getByText('Registration is closed. Ask an admin for an account.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Need an account? Register' })).toHaveCount(0)
  const register = await request.post('/api/auth/register', { data: { username: `e2e-closed-${Date.now()}`, password: PASSWORD } })
  expect(register.status()).toBe(403)

  // Reopening restores the register link.
  await logIn(page, ADMIN_USERNAME)
  await openMenuItem(page, ADMIN_USERNAME, 'Admin')
  await toggle.click()
  await expect(toggle).toBeChecked()
  await logOut(page, ADMIN_USERNAME)
  await expect(page.getByRole('button', { name: 'Need an account? Register' })).toBeVisible()
})
