import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
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
})
