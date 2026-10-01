import { useState } from 'react'
import { api } from '../api/client'
import type { User, UserRole } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import AsyncView from './AsyncView'
import { useAsync } from '../hooks/useAsync'
import { errorMessage } from '../utils/errors'
import './AdminUsers.css'

const ROLE_LABELS: Record<UserRole, string> = {
  Pending: 'Pending approval',
  Standard: 'User',
  Admin: 'Admin',
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

  function deletePendingUser(user: User) {
    if (window.confirm(`Delete pending user '${user.username}'? This cannot be undone.`)) {
      void runAction(() => api.deleteUser(user.id))
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

  return (
    <>
      <hgroup>
        <h2>Users</h2>
        <p>New users can log in once approved. Promoted users get admin rights the next time they log in.</p>
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
                    <div data-row-actions>
                      {user.role === 'Pending' && (
                        <>
                          <button type="button" onClick={() => runAction(() => api.approveUser(user.id))}>
                            Approve
                          </button>
                          <button type="button" data-danger onClick={() => deletePendingUser(user)}>
                            Delete
                          </button>
                        </>
                      )}
                      {user.role === 'Standard' && (
                        <button type="button" onClick={() => runAction(() => api.promoteUser(user.id))}>
                          Promote
                        </button>
                      )}
                      {user.role !== 'Pending' && user.id !== currentUser?.id && (
                        <button type="button" className="secondary" onClick={() => resetPassword(user)}>
                          Reset password
                        </button>
                      )}
                    </div>
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
