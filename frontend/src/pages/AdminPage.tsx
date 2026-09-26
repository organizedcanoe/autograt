import { useState } from 'react'
import { api } from '../api/client'
import type { User, UserRole } from '../api/types'
import AsyncView from '../components/AsyncView'
import { useAsync } from '../hooks/useAsync'
import { errorMessage } from '../utils/errors'

const ROLE_LABELS: Record<UserRole, string> = {
  Pending: 'Pending approval',
  Standard: 'User',
  Admin: 'Admin',
}

export default function AdminPage() {
  const users = useAsync(() => api.listUsers(), [])
  const [error, setError] = useState<string | null>(null)

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

  return (
    <>
      <hgroup>
        <h1>Users</h1>
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
                    {user.role === 'Pending' && (
                      <div role="group">
                        <button type="button" onClick={() => runAction(() => api.approveUser(user.id))}>
                          Approve
                        </button>
                        <button type="button" className="secondary" onClick={() => deletePendingUser(user)}>
                          Delete
                        </button>
                      </div>
                    )}
                    {user.role === 'Standard' && (
                      <button type="button" className="outline" onClick={() => runAction(() => api.promoteUser(user.id))}>
                        Promote
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </AsyncView>
    </>
  )
}
