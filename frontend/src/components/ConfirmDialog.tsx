import Modal from './Modal'

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel: string
  /** Shows the confirm button in red, for actions that can't be undone. */
  danger?: boolean
  onConfirm: () => void
  /** Called by the Cancel button and by Escape. */
  onCancel: () => void
}

/** Asks the user to confirm an action, in place of window.confirm. The caller unmounts it on either choice. */
export default function ConfirmDialog({ title, message, confirmLabel, danger, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p>{message}</p>
      <footer>
        <button type="button" className="secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" data-danger={danger || undefined} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </footer>
    </Modal>
  )
}
