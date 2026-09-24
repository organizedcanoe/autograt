import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import AppendForm from './AppendForm'

describe('AppendForm', () => {
  it('submits the note to the targeted sub-entry and clears the input', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<AppendForm subEntryId={42} onSubmit={onSubmit} />)
    const input = screen.getByLabelText('Add a note')

    await user.type(input, '  It rained later  ')
    await user.click(screen.getByRole('button', { name: 'Append' }))

    expect(onSubmit).toHaveBeenCalledWith(42, 'It rained later')
    expect(input).toHaveValue('')
  })

  it('cannot submit an empty or blank note', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<AppendForm subEntryId={42} onSubmit={onSubmit} />)
    const append = screen.getByRole('button', { name: 'Append' })

    expect(append).toBeDisabled()
    await user.type(screen.getByLabelText('Add a note'), '   ')
    expect(append).toBeDisabled()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('keeps the text and shows the error when saving fails', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockRejectedValue(new Error('Not found'))
    render(<AppendForm subEntryId={42} onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText('Add a note'), 'Lost note')
    await user.click(screen.getByRole('button', { name: 'Append' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Not found')
    expect(screen.getByLabelText('Add a note')).toHaveValue('Lost note')
  })
})
