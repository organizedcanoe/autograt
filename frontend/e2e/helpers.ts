import { expect, type APIRequestContext, type Locator, type Page } from '@playwright/test'

export const PASSWORD = 'password123'

// The journey registers this user first on the fresh database, so it becomes the admin the other specs log in as.
export const ADMIN_USERNAME = 'e2e-admin'

// Matches the app's todayIso(): the browser and the test run on the same machine and time zone.
export function localToday(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

/** Registers a user through the API. Once the admin exists, new users start as pending. */
export async function registerUser(request: APIRequestContext, username: string): Promise<void> {
  const response = await request.post('/api/auth/register', { data: { username, password: PASSWORD } })
  expect(response.ok()).toBe(true)
}

/** Registers a user and approves them through the API as the admin, so they can log in straight away. */
export async function createApprovedUser(request: APIRequestContext, username: string): Promise<void> {
  await registerUser(request, username)
  const login = await request.post('/api/auth/login', { data: { username: ADMIN_USERNAME, password: PASSWORD } })
  const headers = { Authorization: `Bearer ${(await login.json()).token}` }
  const users: { id: number; username: string }[] = await (await request.get('/api/admin/users', { headers })).json()
  const user = users.find((u) => u.username === username)!
  expect((await request.post(`/api/admin/users/${user.id}/approve`, { headers })).ok()).toBe(true)
}

/** Submits the login form, leaving the outcome for the caller to check. */
export async function submitLogin(page: Page, username: string, password = PASSWORD): Promise<void> {
  await page.goto('/')
  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Log in' }).click()
}

export async function logIn(page: Page, username: string, password = PASSWORD): Promise<void> {
  await submitLogin(page, username, password)
  await expect(page.getByRole('banner').getByText(username)).toBeVisible()
}

export async function logOut(page: Page, username: string): Promise<void> {
  await page.getByRole('banner').getByText(username).click()
  await page.getByRole('link', { name: 'Log out' }).click()
  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible()
}

/** Opens an item from the header's user menu. */
export async function openMenuItem(page: Page, username: string, item: 'Settings' | 'Admin' | 'History' | 'Insights' | 'Search'): Promise<void> {
  await page.getByRole('banner').getByText(username).click()
  await page.getByRole('link', { name: item }).click()
  await expect(page.getByRole('heading', { level: 1, name: item })).toBeVisible()
}

/** A user's row in the admin page's user table. */
export function userRow(page: Page, username: string): Locator {
  return page.getByRole('row').filter({ has: page.getByRole('cell', { name: username, exact: true }) })
}

/** Opens a user's ⋯ menu on the admin page and chooses one of its actions. */
export async function chooseUserAction(page: Page, username: string, action: string): Promise<void> {
  const row = userRow(page, username)
  await row.getByLabel(`Actions for ${username}`).click()
  await row.getByRole('button', { name: action }).click()
}
