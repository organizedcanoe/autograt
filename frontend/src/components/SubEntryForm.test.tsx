import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { EntryCategory } from '../api/types'
import SubEntryForm from './SubEntryForm'
import { categoryTint } from './categoryColors'

describe('SubEntryForm', () => {
  it('tints the text box to match the chosen category', async () => {
    const user = userEvent.setup()
    render(<SubEntryForm contentLabel="New entry" submitLabel="Add entry" onSubmit={vi.fn()} />)
    const content = screen.getByLabelText('New entry')

    expect(content).toHaveStyle({ backgroundColor: categoryTint('Good') })
    await user.selectOptions(screen.getByLabelText('Category'), 'Neutral')
    expect(content).toHaveStyle({ backgroundColor: categoryTint('Neutral') })
  })

  it('can derive the label and placeholder from the chosen category', async () => {
    const user = userEvent.setup()
    const label = (category: EntryCategory) => `${category} thing`
    render(<SubEntryForm contentLabel={label} placeholder={label} submitLabel="Add entry" onSubmit={vi.fn()} />)

    await user.selectOptions(screen.getByLabelText('Category'), 'Neutral')

    expect(screen.getByLabelText('Neutral thing')).toHaveAttribute('placeholder', 'Neutral thing')
  })

  it('hides the category picker when the category is locked', () => {
    render(
      <SubEntryForm
        initial={{ category: 'Bad', content: '' }}
        lockCategory
        contentLabel="Bad thing"
        submitLabel="Save"
        onSubmit={vi.fn()}
      />,
    )

    expect(screen.queryByLabelText('Category')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Bad thing')).toHaveStyle({ backgroundColor: categoryTint('Bad') })
  })

  it('clears back to its starting category after saving', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<SubEntryForm contentLabel="New entry" submitLabel="Add entry" onSubmit={onSubmit} />)

    await user.selectOptions(screen.getByLabelText('Category'), 'Bad')
    await user.type(screen.getByLabelText('New entry'), '  Missed the bus  ')
    await user.click(screen.getByRole('button', { name: 'Add entry' }))

    expect(onSubmit).toHaveBeenCalledWith('Bad', 'Missed the bus')
    expect(screen.getByLabelText('Category')).toHaveValue('Good')
    expect(screen.getByLabelText('New entry')).toHaveValue('')
  })
})
