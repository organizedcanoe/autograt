import axe from 'axe-core'
import { expect } from 'vitest'

/**
 * Runs axe over a rendered tree and fails with the rules it breaks. Contrast (jsdom can't compute colours) and
 * landmarks (pages render here without the layout's header and main) are left to the Playwright audit.
 */
export async function expectNoAxeViolations(container: Element): Promise<void> {
  const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } })
  expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([])
}
