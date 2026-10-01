import { expect, test, type Page } from '@playwright/test'
import { ADMIN_USERNAME, PASSWORD, logIn, logOut, openMenuItem, registerUser, submitLogin } from './helpers.ts'

function userRow(page: Page, username: string) {
  return page.getByRole('row').filter({ has: page.getByRole('cell', { name: username, exact: true }) })
}

test('admin approves and promotes a pending user, who then gets admin rights', async ({ page, request }) => {
  const username = `e2e-approve-${Date.now()}`
  await registerUser(request, username)

  await logIn(page, ADMIN_USERNAME)
  await openMenuItem(page, ADMIN_USERNAME, 'Admin')
  const row = userRow(page, username)
  await expect(row.getByRole('cell', { name: 'Pending approval' })).toBeVisible()

  // Approving makes them a standard user, who can then be promoted.
  await row.getByRole('button', { name: 'Approve' }).click()
  await expect(row.getByRole('cell', { name: 'User', exact: true })).toBeVisible()
  await expect(row.getByRole('button', { name: 'Approve' })).toHaveCount(0)
  await row.getByRole('button', { name: 'Promote' }).click()
  await expect(row.getByRole('cell', { name: 'Admin', exact: true })).toBeVisible()
  await expect(row.getByRole('button', { name: 'Promote' })).toHaveCount(0)

  // The promoted user gets the admin page on their next login.
  await logOut(page, ADMIN_USERNAME)
  await logIn(page, username)
  await openMenuItem(page, username, 'Admin')
})

test('admin deletes a pending user only after confirming', async ({ page, request }) => {
  const username = `e2e-delete-${Date.now()}`
  await registerUser(request, username)

  await logIn(page, ADMIN_USERNAME)
  await openMenuItem(page, ADMIN_USERNAME, 'Admin')
  const row = userRow(page, username)

  // Cancelling the confirmation keeps the user.
  page.once('dialog', (dialog) => void dialog.dismiss())
  await row.getByRole('button', { name: 'Delete' }).click()
  await expect(row).toBeVisible()

  page.once('dialog', (dialog) => {
    expect(dialog.message()).toContain(username)
    void dialog.accept()
  })
  await row.getByRole('button', { name: 'Delete' }).click()
  await expect(row).toHaveCount(0)

  // The deleted account no longer exists, so its login is rejected.
  await logOut(page, ADMIN_USERNAME)
  await submitLogin(page, username)
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible()
})

test('a pending user sees the approval notice and cannot log in', async ({ page }) => {
  const username = `e2e-pending-${Date.now()}`

  await page.goto('/')
  await page.getByRole('button', { name: 'Need an account? Register' }).click()
  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByLabel('Confirm password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('status')).toHaveText('Account created. An admin must approve it before you can log in.')

  await submitLogin(page, username)
  await expect(page.getByRole('alert')).toContainText('awaiting admin approval')
  await expect(page.getByRole('banner')).toHaveCount(0)
})

test('a standard user is redirected away from the admin page', async ({ page, request }) => {
  const username = `e2e-standard-${Date.now()}`
  await registerUser(request, username)

  await logIn(page, ADMIN_USERNAME)
  await openMenuItem(page, ADMIN_USERNAME, 'Admin')
  await userRow(page, username).getByRole('button', { name: 'Approve' }).click()
  await expect(userRow(page, username).getByRole('button', { name: 'Promote' })).toBeVisible()
  await logOut(page, ADMIN_USERNAME)

  await logIn(page, username)
  await page.getByRole('banner').getByText(username).click()
  await expect(page.getByRole('link', { name: 'Admin' })).toHaveCount(0)
  await page.goto('/admin')
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Admin' })).toHaveCount(0)
})
