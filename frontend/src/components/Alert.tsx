import type { ReactNode } from 'react'
import './Alert.css'

export type AlertKind = 'error' | 'warning' | 'success'

interface AlertProps {
  kind: AlertKind
  children: ReactNode
}

/** A tinted message card. Errors interrupt screen readers; warnings and confirmations are announced politely. */
export default function Alert({ kind, children }: AlertProps) {
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} data-alert={kind}>
      {children}
    </div>
  )
}
