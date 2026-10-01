import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useParams } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import JumpToDate from './JumpToDate'

function DayStub() {
  return <p>Day {useParams().date}</p>
}

function renderJump() {
  render(
    <MemoryRouter initialEntries={['/search']}>
      <Routes>
        <Route path="/search" element={<JumpToDate />} />
        <Route path="/day/:date" element={<DayStub />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('JumpToDate', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 23, 12, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not allow picking a future date', () => {
    renderJump()

    expect(screen.getByLabelText('Date')).toHaveAttribute('max', '2026-09-23')
  })

  it('opens the chosen day', async () => {
    const user = userEvent.setup()
    renderJump()

    await user.type(screen.getByLabelText('Date'), '2025-03-14')
    await user.click(screen.getByRole('button', { name: 'Go' }))

    expect(screen.getByText('Day 2025-03-14')).toBeInTheDocument()
  })
})
