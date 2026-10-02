import { useState } from 'react'
import { api } from '../api/client'
import type { User, UserRole } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import AsyncView from './AsyncView'
import { useAsync } from '../hooks/useAsync'
import { errorMessage } from '../utils/errors'
import './AdminUsers.css'

interface UserAction {
  label: string
  run: () => void
}

const ROLE_LABELS: Record<UserRole, string> = {
  Pending: 'Pending approval',
  Standard: 'User',
  Admin: 'Admin',
  Disabled: 'Disabled',
}

export default function AdminUsers() {
  const { user: currentUser } = useAuth()
  const users = useAsync(() => api.listUsers(), [])
  const [error, setError] = useState<string | null>(null)
  // Shown once after a reset; the server never returns it again.
  const [reset, setReset] = useState<{ username: string; temporaryPassword: string } | null>(null)

  async function runAction(action: () => Promise<void>) {
    setError(null)
    try {
      await action()
      users.reload()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  function deleteUser(user: User) {
    const question =
      user.role === 'Pending'
        ? `Delete pending user '${user.username}'? This cannot be undone.`
        : `Delete '${user.username}' and all their journal entries, ratings and settings? This cannot be undone.`
    if (window.confirm(question)) {
      void runAction(() => api.deleteUser(user.id))
    }
  }

  function disableUser(user: User) {
    const question = `Disable '${user.username}'? They will be signed out and can't log in until enabled again. Their journal is kept.`
    if (window.confirm(question)) {
      void runAction(() => api.disableUser(user.id))
    }
  }

  function resetPassword(user: User) {
    const question = `Reset the password for '${user.username}'? They will be signed out everywhere and must choose a new password when they next log in.`
    if (window.confirm(question)) {
      void runAction(async () => {
        const { temporaryPassword } = await api.resetUserPassword(user.id)
        setReset({ username: user.username, temporaryPassword })
      })
    }
  }

  /** The actions that apply to a user's role, in the order the dropdown lists them. */
  function actionsFor(user: User): UserAction[] {
    const isSelf = user.id === currentUser?.id
    const actions: UserAction[] = []
    if (user.role === 'Pending') actions.push({ label: 'Approve', run: () => runAction(() => api.approveUser(user.id)) })
    if (user.role === 'Standard') {
      actions.push({ label: 'Promote', run: () => runAction(() => api.promoteUser(user.id)) })
      actions.push({ label: 'Disable', run: () => disableUser(user) })
    }
    if (user.role === 'Admin' && !isSelf) actions.push({ label: 'Demote', run: () => runAction(() => api.demoteUser(user.id)) })
    if (user.role === 'Disabled') actions.push({ label: 'Enable', run: () => runAction(() => api.enableUser(user.id)) })
    if (user.role !== 'Pending' && !isSelf) actions.push({ label: 'Reset password', run: () => resetPassword(user) })
    if (user.role !== 'Admin') actions.push({ label: 'Delete', run: () => deleteUser(user) })
    return actions
  }

  return (
    <>
      <hgroup>
        <h2>Users</h2>
        <p>New users can log in once approved. Role changes take effect straight away. Admins must be demoted before they can be disabled or deleted.</p>
      </hgroup>
      {error && <p role="alert">{error}</p>}
      <AsyncView state={users}>
        {(list) => (
          <table>
            <thead>
              <tr>
                <th scope="col">Username</th>
                <th scope="col">Role</th>
                <th scope="col">
                  <span hidden>Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((user) => (
                <tr key={user.id}>
                  <td>{user.username}</td>
                  <td>{ROLE_LABELS[user.role]}</td>
                  <td>
                    <UserActions username={user.username} actions={actionsFor(user)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </AsyncView>
      {reset && (
        <dialog open>
          <article>
            <h3>Temporary password for {reset.username}</h3>
            <p>
              <code>{reset.temporaryPassword}</code>
            </p>
            <p>Give it to {reset.username}; they will choose a new password when they log in. It won't be shown again.</p>
            <footer>
              <button
                type="button"
                className="secondary"
                onClick={() => void navigator.clipboard?.writeText(reset.temporaryPassword).catch(() => {})}
              >
                Copy
              </button>
              <button type="button" onClick={() => setReset(null)}>
                Done
              </button>
            </footer>
          </article>
        </dialog>
      )}
    </>
  )
}

/** One dropdown per row instead of a button per action, so every row lines up at the same height. */
function UserActions({ username, actions }: { username: string; actions: UserAction[] }) {
  if (actions.length === 0) return null

  return (
    // Always shows the placeholder: choosing runs the action rather than storing a value.
    <select
      aria-label={`Actions for ${username}`}
      value=""
      onChange={(e) => actions.find((action) => action.label === e.target.value)?.run()}
    >
      <option value="" disabled>
        Actions
      </option>
      {actions.map((action) => (
        <option key={action.label}>{action.label}</option>
      ))}
    </select>
  )
}
