import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ConfirmDialog from './ConfirmDialog'

function renderDialog(danger?: boolean) {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  render(
    <ConfirmDialog
      title="Delete note?"
      message="Delete this note? This cannot be undone."
      confirmLabel="Delete"
      danger={danger}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  )
  return { onConfirm, onCancel }
}

describe('ConfirmDialog', () => {
  it('shows the message in a dialog named by its title', () => {
    renderDialog()

    expect(screen.getByRole('dialog', { name: 'Delete note?' })).toHaveTextContent('Delete this note? This cannot be undone.')
  })

  it('confirms with the confirm button', async () => {
    const { onConfirm, onCancel } = renderDialog()

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))

    expect(onConfirm).toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('cancels with the Cancel button', async () => {
    const { onConfirm, onCancel } = renderDialog()

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onCancel).toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('cancels on Escape', () => {
    const { onCancel } = renderDialog()

    // Browsers fire cancel on the dialog when Escape is pressed.
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))

    expect(onCancel).toHaveBeenCalled()
  })

  it('styles the confirm button as danger only when asked', () => {
    renderDialog(true)

    expect(screen.getByRole('button', { name: 'Delete' })).toHaveAttribute('data-danger')
    expect(screen.getByRole('button', { name: 'Cancel' })).not.toHaveAttribute('data-danger')
  })

  it('leaves the confirm button plain by default', () => {
    renderDialog()

    expect(screen.getByRole('button', { name: 'Delete' })).not.toHaveAttribute('data-danger')
  })
})
