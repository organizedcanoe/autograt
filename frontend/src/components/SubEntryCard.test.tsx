import { render, screen, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
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

const append = { id: 9, subEntryId: 5, content: 'Still tired', createdAtUtc: '2026-09-25T08:30:00Z' }

/** Expects the confirm dialog to ask the question, then answers it with one of its buttons. */
async function answerConfirmation(user: UserEvent, question: string, button: string) {
  const dialog = within(await screen.findByRole('dialog'))
  expect(dialog.getByText(question)).toBeInTheDocument()
  await user.click(dialog.getByRole('button', { name: button }))
}

describe('SubEntryCard', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('tints the card by its category', () => {
    render(<SubEntryCard subEntry={{ ...subEntry, category: 'Bad' }} onAppend={vi.fn()} />)

    expect(screen.getByRole('article')).toHaveStyle({ backgroundColor: categoryTint('Bad') })
  })

  it("shows each append's content followed by its full date and time", () => {
    render(<SubEntryCard subEntry={{ ...subEntry, appends: [append] }} onAppend={vi.fn()} />)

    const timestamp = formatDateTime(append.createdAtUtc)
    const item = screen.getByRole('listitem')
    expect(item.textContent).toBe(`Still tired${timestamp}`)
    // The date sits on its own line beneath the content.
    expect(item.querySelector('br + small')).toHaveTextContent(timestamp)
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

  it('has no delete buttons when deleting is not allowed', () => {
    render(<SubEntryCard subEntry={{ ...subEntry, appends: [append] }} onAppend={vi.fn()} />)

    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete note' })).not.toBeInTheDocument()
  })

  it('deletes the entry once confirmed', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn().mockResolvedValue(undefined)
    render(<SubEntryCard subEntry={subEntry} onAppend={vi.fn()} onDelete={onDelete} />)

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    await answerConfirmation(user, 'Delete this entry and its notes? This cannot be undone.', 'Delete')
    expect(onDelete).toHaveBeenCalledWith(5)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('keeps the entry when the confirmation is cancelled', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    render(<SubEntryCard subEntry={subEntry} onAppend={vi.fn()} onDelete={onDelete} />)

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await answerConfirmation(user, 'Delete this entry and its notes? This cannot be undone.', 'Cancel')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('deletes a note once confirmed', async () => {
    const user = userEvent.setup()
    const onDeleteAppend = vi.fn().mockResolvedValue(undefined)
    render(<SubEntryCard subEntry={{ ...subEntry, appends: [append] }} onAppend={vi.fn()} onDeleteAppend={onDeleteAppend} />)

    await user.click(screen.getByRole('button', { name: 'Delete note' }))

    await answerConfirmation(user, 'Delete this note? This cannot be undone.', 'Delete')
    expect(onDeleteAppend).toHaveBeenCalledWith(9)
  })

  it('styles the delete confirmation as danger', async () => {
    const user = userEvent.setup()
    render(<SubEntryCard subEntry={subEntry} onAppend={vi.fn()} onDelete={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' })).toHaveAttribute('data-danger')
  })

  it('shows the error when deleting fails', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn().mockRejectedValue(new Error('Past days are read-only.'))
    render(<SubEntryCard subEntry={subEntry} onAppend={vi.fn()} onDelete={onDelete} />)

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await answerConfirmation(user, 'Delete this entry and its notes? This cannot be undone.', 'Delete')

    expect(await screen.findByRole('alert')).toHaveTextContent('Past days are read-only.')
  })
})
