import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import RatingForm from './RatingForm'

describe('RatingForm', () => {
  it('starts on the current rating with saving disabled until it changes', async () => {
    const user = userEvent.setup()
    render(<RatingForm rating={7} onSubmit={vi.fn()} />)
    const save = screen.getByRole('button', { name: 'Save rating' })

    expect(screen.getByLabelText('Change rating')).toHaveValue('7')
    expect(save).toBeDisabled()

    await user.selectOptions(screen.getByLabelText('Change rating'), '4')
    expect(save).toBeEnabled()
  })

  it('submits the new rating as a number', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<RatingForm rating={7} onSubmit={onSubmit} />)

    await user.selectOptions(screen.getByLabelText('Change rating'), '10')
    await user.click(screen.getByRole('button', { name: 'Save rating' }))

    expect(onSubmit).toHaveBeenCalledWith(10)
  })

  it('shows the error when saving fails', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockRejectedValue(new Error('Past days are read-only.'))
    render(<RatingForm rating={7} onSubmit={onSubmit} />)

    await user.selectOptions(screen.getByLabelText('Change rating'), '2')
    await user.click(screen.getByRole('button', { name: 'Save rating' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Past days are read-only.')
  })
})
