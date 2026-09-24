import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import DailyEntryForm from './DailyEntryForm'
import { categoryTint } from './categoryColors'

describe('DailyEntryForm', () => {
  it('keeps submit disabled until a day rating is chosen', async () => {
    const user = userEvent.setup()
    render(<DailyEntryForm date="2026-09-23" onSubmit={vi.fn()} />)
    const submit = screen.getByRole('button', { name: 'Save day' })

    expect(submit).toBeDisabled()
    await user.type(screen.getByLabelText('Good thing 1'), 'Coffee')
    expect(submit).toBeDisabled()

    await user.selectOptions(screen.getByLabelText('How was your day?'), '7')
    expect(submit).toBeEnabled()
  })

  it('offers two good boxes and one bad box by default', () => {
    render(<DailyEntryForm date="2026-09-23" onSubmit={vi.fn()} />)

    expect(screen.getByLabelText('Good thing 1')).toBeInTheDocument()
    expect(screen.getByLabelText('Good thing 2')).toBeInTheDocument()
    expect(screen.getByLabelText('Bad thing')).toBeInTheDocument()
  })

  it('tints each box by its category', () => {
    render(<DailyEntryForm date="2026-09-23" onSubmit={vi.fn()} />)

    expect(screen.getByLabelText('Good thing 1')).toHaveStyle({ backgroundColor: categoryTint('Good') })
    expect(screen.getByLabelText('Bad thing')).toHaveStyle({ backgroundColor: categoryTint('Bad') })
  })

  it('submits the rating and only the filled-in boxes', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<DailyEntryForm date="2026-09-23" onSubmit={onSubmit} />)

    await user.selectOptions(screen.getByLabelText('How was your day?'), '0')
    await user.type(screen.getByLabelText('Good thing 1'), 'Walked the dog')
    await user.type(screen.getByLabelText('Bad thing'), 'Missed the bus')
    await user.click(screen.getByRole('button', { name: 'Save day' }))

    expect(onSubmit).toHaveBeenCalledWith({
      entryDate: '2026-09-23',
      dayRating: 0,
      subEntries: [
        { category: 'Good', content: 'Walked the dog' },
        { category: 'Bad', content: 'Missed the bus' },
      ],
    })
  })

  it('shows the error when saving fails', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockRejectedValue(new Error('An entry already exists for this date.'))
    render(<DailyEntryForm date="2026-09-23" onSubmit={onSubmit} />)

    await user.selectOptions(screen.getByLabelText('How was your day?'), '5')
    await user.click(screen.getByRole('button', { name: 'Save day' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('An entry already exists for this date.')
  })
})
