import { expect, test, type Page } from '@playwright/test'
import { ADMIN_USERNAME, PASSWORD, chooseUserAction, createApprovedUser, logIn, logOut, openMenuItem, submitLogin } from './helpers.ts'

const NEW_PASSWORD = 'a-brand-new-password'

async function changePassword(page: Page, currentPassword: string) {
  await page.getByLabel(/^(Current|Temporary) password$/).fill(currentPassword)
  await page.getByLabel('New password', { exact: true }).fill(NEW_PASSWORD)
  await page.getByLabel('Confirm new password').fill(NEW_PASSWORD)
  await page.getByRole('button', { name: 'Change password' }).click()
}

test('a user changes their password and logs in with the new one', async ({ page, request }) => {
  const username = `e2e-password-${Date.now()}`
  await createApprovedUser(request, username)

  await logIn(page, username)
  await openMenuItem(page, username, 'Settings')
  await changePassword(page, PASSWORD)
  await expect(page.getByRole('status')).toHaveText('Password changed. Other devices have been signed out.')

  // This session stays signed in; the old password no longer works.
  await logOut(page, username)
  await submitLogin(page, username)
  await expect(page.getByRole('alert')).toContainText('Invalid username or password')
  await logIn(page, username, NEW_PASSWORD)
})

test('an admin resets a password and the user must choose a new one', async ({ page, request }) => {
  const username = `e2e-reset-${Date.now()}`
  await createApprovedUser(request, username)

  await logIn(page, ADMIN_USERNAME)
  await openMenuItem(page, ADMIN_USERNAME, 'Admin')
  page.once('dialog', (dialog) => void dialog.accept())
  await chooseUserAction(page, username, 'Reset password')
  const temporaryPassword = await page.getByRole('dialog').locator('code').innerText()
  await page.getByRole('button', { name: 'Done' }).click()
  await logOut(page, ADMIN_USERNAME)

  await submitLogin(page, username, temporaryPassword)
  await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible()
  await changePassword(page, temporaryPassword)

  await expect(page.getByRole('banner').getByText(username)).toBeVisible()
  await logOut(page, username)
  await logIn(page, username, NEW_PASSWORD)
})

test('a user deletes their account after confirming and can no longer log in', async ({ page, request }) => {
  const username = `e2e-delete-account-${Date.now()}`
  await createApprovedUser(request, username)

  await logIn(page, username)
  await openMenuItem(page, username, 'Settings')

  // Cancelling keeps the account.
  await page.getByRole('button', { name: 'Delete account…' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await page.getByRole('button', { name: 'Delete account…' }).click()
  await page.getByRole('dialog').getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Delete forever' }).click()
  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible()

  await submitLogin(page, username)
  await expect(page.getByRole('alert')).toContainText('Invalid username or password')
})
