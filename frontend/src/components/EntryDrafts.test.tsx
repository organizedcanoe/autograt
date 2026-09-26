import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import EntryDrafts from './EntryDrafts'
import { categoryTint } from './categoryColors'

describe('EntryDrafts', () => {
  it('nudges with two good boxes and one bad box', () => {
    render(<EntryDrafts nudge onAdd={vi.fn()} />)

    expect(screen.getByLabelText('Good thing 1')).toHaveStyle({ backgroundColor: categoryTint('Good') })
    expect(screen.getByLabelText('Good thing 2')).toHaveStyle({ backgroundColor: categoryTint('Good') })
    expect(screen.getByLabelText('Bad thing')).toHaveStyle({ backgroundColor: categoryTint('Bad') })
  })

  it('offers a single blank box without the nudge', () => {
    render(<EntryDrafts nudge={false} onAdd={vi.fn()} />)

    expect(screen.getAllByRole('textbox')).toHaveLength(1)
    expect(screen.getByLabelText('New entry')).toBeInTheDocument()
  })

  it('saves one box at a time and removes only that box', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn().mockResolvedValue(undefined)
    render(<EntryDrafts nudge onAdd={onAdd} />)

    await user.type(screen.getByLabelText('Good thing 2'), 'Walked the dog')
    await user.type(screen.getByLabelText('Bad thing'), 'Missed the bus')
    await user.click(screen.getAllByRole('button', { name: 'Add entry' })[1])

    expect(onAdd).toHaveBeenCalledOnce()
    expect(onAdd).toHaveBeenCalledWith('Good', 'Walked the dog')
    expect(screen.queryByLabelText('Good thing 2')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Good thing 1')).toBeInTheDocument()
    expect(screen.getByLabelText('Bad thing')).toHaveValue('Missed the bus')
  })

  it('lets a nudge box be saved under another category', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn().mockResolvedValue(undefined)
    render(<EntryDrafts nudge onAdd={onAdd} />)

    await user.selectOptions(screen.getAllByLabelText('Category')[0], 'Neutral')
    await user.type(screen.getByLabelText('Good thing 1'), 'Quiet day')
    await user.click(screen.getAllByRole('button', { name: 'Add entry' })[0])

    expect(onAdd).toHaveBeenCalledWith('Neutral', 'Quiet day')
  })

  it('keeps a blank box available once every box is saved', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn().mockResolvedValue(undefined)
    render(<EntryDrafts nudge={false} onAdd={onAdd} />)

    await user.type(screen.getByLabelText('New entry'), 'First')
    await user.click(screen.getByRole('button', { name: 'Add entry' }))
    await user.type(await screen.findByLabelText('New entry'), 'Second')
    await user.click(screen.getByRole('button', { name: 'Add entry' }))

    expect(onAdd).toHaveBeenNthCalledWith(1, 'Good', 'First')
    expect(onAdd).toHaveBeenNthCalledWith(2, 'Good', 'Second')
    expect(screen.getByLabelText('New entry')).toHaveValue('')
  })

  it('keeps the box and shows the error when saving fails', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn().mockRejectedValue(new Error('Past days are read-only.'))
    render(<EntryDrafts nudge onAdd={onAdd} />)

    await user.type(screen.getByLabelText('Bad thing'), 'Missed the bus')
    await user.click(screen.getAllByRole('button', { name: 'Add entry' })[2])

    expect(await screen.findByRole('alert')).toHaveTextContent('Past days are read-only.')
    expect(screen.getByLabelText('Bad thing')).toHaveValue('Missed the bus')
  })
})
