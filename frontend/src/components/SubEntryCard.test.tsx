import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { SubEntry } from '../api/types'
import { formatDateTime } from '../utils/dates'
import SubEntryCard from './SubEntryCard'
import { categoryTint } from './categoryColors'

const subEntry: SubEntry = {
  id: 5,
  category: 'Good',
  content: 'Walked the dog',
  createdAtUtc: '2026-09-23T18:00:00Z',
  appends: [],
}

describe('SubEntryCard', () => {
  it('tints the card by its category', () => {
    render(<SubEntryCard subEntry={{ ...subEntry, category: 'Bad' }} onAppend={vi.fn()} />)

    expect(screen.getByRole('article')).toHaveStyle({ backgroundColor: categoryTint('Bad') })
  })

  it('shows the full date and time of each append', () => {
    const append = { id: 9, subEntryId: 5, content: 'Still tired', createdAtUtc: '2026-09-25T08:30:00Z' }
    render(<SubEntryCard subEntry={{ ...subEntry, appends: [append] }} onAppend={vi.fn()} />)

    expect(screen.getByText(formatDateTime(append.createdAtUtc))).toHaveAttribute('dateTime', append.createdAtUtc)
  })

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
