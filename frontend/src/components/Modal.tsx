import { useEffect, useId, useRef, type ReactNode, type SyntheticEvent } from 'react'

interface ModalProps {
  title: string
  /** Called when the user dismisses the dialog with Escape; the caller unmounts it. */
  onClose: () => void
  /** The body and a footer of buttons, inside the dialog's article. */
  children: ReactNode
}

/**
 * A modal dialog: it opens with showModal, so focus moves into it and stays there and the page behind is inert.
 * Escape closes it, and focus goes back to whatever opened it once it unmounts.
 */
export default function Modal({ title, onClose, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  // Read on the first render, before the dialog takes focus.
  const openerRef = useRef(document.activeElement)

  useEffect(() => {
    const dialog = dialogRef.current
    const opener = openerRef.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => {
      if (opener instanceof HTMLElement) opener.focus()
    }
  }, [])

  // The browser would close the dialog itself, leaving it mounted; the caller decides instead.
  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault()
    onClose()
  }

  return (
    <dialog ref={dialogRef} aria-labelledby={titleId} onCancel={handleCancel}>
      <article>
        <h3 id={titleId}>{title}</h3>
        {children}
      </article>
    </dialog>
  )
}
