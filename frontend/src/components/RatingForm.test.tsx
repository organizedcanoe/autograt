import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import RatingForm from './RatingForm'

describe('RatingForm', () => {
  it('starts on the current rating without a save button', () => {
    render(<RatingForm rating={7} onSubmit={vi.fn()} />)

    expect(screen.getByLabelText('Change rating')).toHaveValue('7')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('saves a first rating as soon as it is picked', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<RatingForm rating={null} onSubmit={onSubmit} />)

    expect(screen.getByLabelText('How was your day?')).toHaveValue('')
    await user.selectOptions(screen.getByLabelText('How was your day?'), '0')

    expect(onSubmit).toHaveBeenCalledWith(0)
  })

  it('saves a changed rating as a number', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<RatingForm rating={7} onSubmit={onSubmit} />)

    await user.selectOptions(screen.getByLabelText('Change rating'), '10')

    expect(onSubmit).toHaveBeenCalledWith(10)
  })

  it('disables the picker while saving', async () => {
    const user = userEvent.setup()
    render(<RatingForm rating={7} onSubmit={() => new Promise(() => {})} />)
    const select = screen.getByLabelText('Change rating')

    await user.selectOptions(select, '4')

    expect(select).toBeDisabled()
    expect(select).toHaveAttribute('aria-busy', 'true')
  })

  it('shows the error and goes back to the saved rating when saving fails', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockRejectedValue(new Error('Past days are read-only.'))
    render(<RatingForm rating={7} onSubmit={onSubmit} />)

    await user.selectOptions(screen.getByLabelText('Change rating'), '2')

    expect(await screen.findByRole('alert')).toHaveTextContent('Past days are read-only.')
    expect(screen.getByLabelText('Change rating')).toHaveValue('7')
    expect(screen.getByLabelText('Change rating')).toBeEnabled()
  })
})
