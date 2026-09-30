import { expect, type APIRequestContext, type Page } from '@playwright/test'

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

/** Submits the login form, leaving the outcome for the caller to check. */
export async function submitLogin(page: Page, username: string): Promise<void> {
  await page.goto('/')
  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Log in' }).click()
}

export async function logIn(page: Page, username: string): Promise<void> {
  await submitLogin(page, username)
  await expect(page.getByRole('banner').getByText(username)).toBeVisible()
}

export async function logOut(page: Page, username: string): Promise<void> {
  await page.getByRole('banner').getByText(username).click()
  await page.getByRole('link', { name: 'Log out' }).click()
  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible()
}

/** Opens an item from the header's user menu. */
export async function openMenuItem(page: Page, username: string, item: 'Settings' | 'Admin'): Promise<void> {
  await page.getByRole('banner').getByText(username).click()
  await page.getByRole('link', { name: item }).click()
  await expect(page.getByRole('heading', { level: 1, name: item })).toBeVisible()
}
