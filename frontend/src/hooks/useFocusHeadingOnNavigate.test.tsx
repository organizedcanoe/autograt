import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef } from 'react'
import { Link, MemoryRouter, Outlet, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { useFocusHeadingOnNavigate } from './useFocusHeadingOnNavigate'

function Shell() {
  const mainRef = useRef<HTMLElement>(null)
  useFocusHeadingOnNavigate(mainRef)
  return (
    <>
      <Link to="/other">Other page</Link>
      <main ref={mainRef}>
        <Outlet />
      </main>
    </>
  )
}

function renderShell() {
  render(
    <MemoryRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<h1>Home</h1>} />
          <Route path="other" element={<h1>Other</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('useFocusHeadingOnNavigate', () => {
  it('leaves focus alone on the first page', () => {
    renderShell()

    expect(screen.getByRole('heading', { name: 'Home' })).not.toHaveFocus()
  })

  it("moves focus to the new page's heading after navigating", async () => {
    renderShell()

    await userEvent.click(screen.getByRole('link', { name: 'Other page' }))

    const heading = screen.getByRole('heading', { name: 'Other' })
    expect(heading).toHaveFocus()
    expect(heading).toHaveAttribute('tabindex', '-1')
  })
})
