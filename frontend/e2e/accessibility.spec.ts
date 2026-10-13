import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { ADMIN_USERNAME, createApprovedUser, localToday, logIn, PASSWORD } from './helpers.ts'

// Unique per worker: a failed test restarts the worker, which runs beforeAll again.
const USERNAME = `e2e-a11y-${Date.now()}`
const SCHEMES = ['light', 'dark'] as const

/** Fails with each WCAG 2 A/AA rule the page breaks and the elements that break it. */
async function expectNoViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  const violations = results.violations.map((violation) => ({
    page: page.url(),
    rule: violation.id,
    elements: violation.nodes.map((node) => `${node.target.join(' ')}: ${node.failureSummary}`),
  }))
  expect(violations).toEqual([])
}

test.beforeAll(async ({ request }) => {
  await createApprovedUser(request, USERNAME)
  // Today rated and written about, so the heatmap, calendar, chart and search all have something to show.
  const login = await request.post('/api/auth/login', { data: { username: USERNAME, password: PASSWORD } })
  const headers = { Authorization: `Bearer ${(await login.json()).token}` }
  const today = localToday()
  await request.put(`/api/journal/entries/${today}/rating`, { headers, data: { dayRating: 5 } })
  await request.post(`/api/journal/entries/${today}/sub-entries`, {
    headers,
    data: { category: 'Good', content: 'Walked the dog' },
  })
})

test('the login page passes axe', async ({ page }) => {
  for (const scheme of SCHEMES) {
    await page.emulateMedia({ colorScheme: scheme })
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible()
    await expectNoViolations(page)
  }
})

for (const scheme of SCHEMES) {
  test(`every page passes axe in the ${scheme} theme`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme })
    await logIn(page, USERNAME)
    const today = localToday()

    for (const path of ['/', `/day/${today}`, '/history', '/insights', '/search?q=dog', '/settings']) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)
      await expectNoViolations(page)
    }
  })
}

test('the admin page passes axe', async ({ page }) => {
  await logIn(page, ADMIN_USERNAME)
  await page.goto('/admin')
  await expect(page.getByRole('table')).toBeVisible()
  await expectNoViolations(page)
})

test('the heatmap and calendar are reachable and operable with the keyboard', async ({ page }) => {
  await logIn(page, USERNAME)
  const today = localToday()
  await page.goto('/history')
  await expect(page.locator(`a[href="/day/${today}"]`)).toBeVisible()

  // The calendar is one tab stop, on today.
  await page.getByRole('button', { name: 'Show' }).first().focus()
  await page.keyboard.press('Tab')
  await expect(page.locator(':focus')).toHaveAttribute('href', `/day/${today}`)
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(`/day/${today}`)
  // Navigating moves focus to the new page's heading.
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused()
})
