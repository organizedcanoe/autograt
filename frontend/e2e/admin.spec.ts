import { expect, test } from '@playwright/test'
import {
  ADMIN_USERNAME,
  PASSWORD,
  chooseUserAction,
  createApprovedUser,
  logIn,
  logOut,
  openMenuItem,
  registerUser,
  submitLogin,
  userRow,
} from './helpers.ts'

test('admin approves and promotes a pending user, who then gets admin rights', async ({ page, request }) => {
  const username = `e2e-approve-${Date.now()}`
  await registerUser(request, username)

  await logIn(page, ADMIN_USERNAME)
  await openMenuItem(page, ADMIN_USERNAME, 'Admin')
  const row = userRow(page, username)
  await expect(row.getByRole('cell', { name: 'Pending approval' })).toBeVisible()

  // Approving makes them a standard user, who can then be promoted.
  await chooseUserAction(page, username, 'Approve')
  await expect(row.getByRole('cell', { name: 'User', exact: true })).toBeVisible()
  await chooseUserAction(page, username, 'Promote')
  await expect(row.getByRole('cell', { name: 'Admin', exact: true })).toBeVisible()

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
  await chooseUserAction(page, username, 'Delete')
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(row).toBeVisible()

  await chooseUserAction(page, username, 'Delete')
  await expect(page.getByRole('dialog')).toContainText(username)
  await page.getByRole('dialog').getByRole('button', { name: 'Delete user' }).click()
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
  await chooseUserAction(page, username, 'Approve')
  await expect(userRow(page, username).getByRole('cell', { name: 'User', exact: true })).toBeVisible()
  await logOut(page, ADMIN_USERNAME)

  await logIn(page, username)
  await page.getByRole('banner').getByText(username).click()
  await expect(page.getByRole('link', { name: 'Admin' })).toHaveCount(0)
  await page.goto('/admin')
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Admin' })).toHaveCount(0)
})

test('admin disables a user, who can no longer log in until enabled again', async ({ page, request }) => {
  const username = `e2e-disable-${Date.now()}`
  await createApprovedUser(request, username)

  await logIn(page, ADMIN_USERNAME)
  await openMenuItem(page, ADMIN_USERNAME, 'Admin')
  const row = userRow(page, username)
  await chooseUserAction(page, username, 'Disable')
  await page.getByRole('dialog').getByRole('button', { name: 'Disable user' }).click()
  await expect(row.getByRole('cell', { name: 'Disabled', exact: true })).toBeVisible()
  await logOut(page, ADMIN_USERNAME)

  await submitLogin(page, username)
  await expect(page.getByRole('alert')).toContainText('disabled')

  await logIn(page, ADMIN_USERNAME)
  await openMenuItem(page, ADMIN_USERNAME, 'Admin')
  await chooseUserAction(page, username, 'Enable')
  await expect(userRow(page, username).getByRole('cell', { name: 'User', exact: true })).toBeVisible()
  await logOut(page, ADMIN_USERNAME)
  await logIn(page, username)
})

test('admin demotes another admin, who loses the admin page straight away', async ({ browser, page, request }) => {
  const username = `e2e-demote-${Date.now()}`
  await createApprovedUser(request, username)
  await logIn(page, ADMIN_USERNAME)
  await openMenuItem(page, ADMIN_USERNAME, 'Admin')
  const row = userRow(page, username)
  await chooseUserAction(page, username, 'Promote')
  await expect(row.getByRole('cell', { name: 'Admin', exact: true })).toBeVisible()

  // The other admin is signed in elsewhere while being demoted.
  const otherPage = await (await browser.newContext()).newPage()
  await logIn(otherPage, username)
  await openMenuItem(otherPage, username, 'Admin')

  await chooseUserAction(page, username, 'Demote')
  await expect(row.getByRole('cell', { name: 'User', exact: true })).toBeVisible()

  await otherPage.reload()
  await otherPage.getByRole('banner').getByText(username).click()
  await expect(otherPage.getByRole('link', { name: 'Admin' })).toHaveCount(0)
  await otherPage.context().close()
})
