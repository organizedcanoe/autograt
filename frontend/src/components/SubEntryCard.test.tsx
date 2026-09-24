import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { SubEntry } from '../api/types'
import SubEntryCard from './SubEntryCard'

const subEntry: SubEntry = {
  id: 5,
  category: 'Good',
  content: 'Walked the dog',
  createdAtUtc: '2026-09-23T18:00:00Z',
  appends: [],
}

describe('SubEntryCard', () => {
  it('has no edit button when editing is not allowed', () => {
    render(<SubEntryCard subEntry={subEntry} onAppend={vi.fn()} />)

    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  })

  it('edits the category and content, then closes the form', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn().mockResolvedValue(undefined)
    render(<SubEntryCard subEntry={subEntry} onAppend={vi.fn()} onEdit={onEdit} />)

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    const content = screen.getByLabelText('Entry')
    expect(content).toHaveValue('Walked the dog')
    await user.selectOptions(screen.getByLabelText('Category'), 'Neutral')
    await user.clear(content)
    await user.type(content, 'Walked the dog in the rain')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onEdit).toHaveBeenCalledWith(5, 'Neutral', 'Walked the dog in the rain')
    expect(screen.queryByLabelText('Entry')).not.toBeInTheDocument()
  })

  it('discards changes on cancel', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    render(<SubEntryCard subEntry={subEntry} onAppend={vi.fn()} onEdit={onEdit} />)

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.type(screen.getByLabelText('Entry'), ' changed')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onEdit).not.toHaveBeenCalled()
    expect(screen.getByText('Walked the dog')).toBeInTheDocument()
  })

  it('keeps the form open and shows the error when saving fails', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn().mockRejectedValue(new Error('Past days are read-only.'))
    render(<SubEntryCard subEntry={subEntry} onAppend={vi.fn()} onEdit={onEdit} />)

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Past days are read-only.')
    expect(screen.getByLabelText('Entry')).toBeInTheDocument()
  })
})
