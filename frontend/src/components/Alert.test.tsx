import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Alert from './Alert'

describe('Alert', () => {
  it.each([
    ['error', 'alert'],
    ['warning', 'status'],
    ['success', 'status'],
  ] as const)('renders a %s card with the %s role', (kind, role) => {
    render(<Alert kind={kind}>Something happened.</Alert>)

    const alert = screen.getByRole(role)
    expect(alert).toHaveTextContent('Something happened.')
    expect(alert).toHaveAttribute('data-alert', kind)
  })

  it('renders block content', () => {
    render(
      <Alert kind="error">
        <p>Problems:</p>
        <ul>
          <li>First</li>
        </ul>
      </Alert>,
    )

    expect(screen.getByRole('alert')).toContainElement(screen.getByRole('listitem'))
  })
})
