import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import Modal from './Modal'

function Opener({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false)
  function close() {
    onClose?.()
    setOpen(false)
  }
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      {open && (
        <Modal title="Are you sure?" onClose={close}>
          <button type="button" onClick={close}>
            Cancel
          </button>
        </Modal>
      )}
    </>
  )
}

describe('Modal', () => {
  it('opens as a modal dialog named by its title', async () => {
    const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal')
    render(<Opener />)

    await userEvent.click(screen.getByRole('button', { name: 'Open' }))

    expect(showModal).toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Are you sure?' })).toBeInTheDocument()
    showModal.mockRestore()
  })

  it('closes on Escape', async () => {
    const onClose = vi.fn()
    render(<Opener onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Open' }))

    // Browsers fire cancel on the dialog when Escape is pressed.
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))

    expect(onClose).toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('returns focus to the button that opened it', async () => {
    const user = userEvent.setup()
    render(<Opener />)
    const opener = screen.getByRole('button', { name: 'Open' })

    await user.click(opener)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(opener).toHaveFocus()
  })
})
