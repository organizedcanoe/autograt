import { useState } from 'react'
import { api } from '../api/client'
import AsyncView from '../components/AsyncView'
import { useAsync } from '../hooks/useAsync'
import { errorMessage } from '../utils/errors'

export default function AdminPage() {
  const users = useAsync(() => api.listUsers(), [])
  const [error, setError] = useState<string | null>(null)

  async function promote(userId: number) {
    setError(null)
    try {
      await api.promoteUser(userId)
      users.reload()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <>
      <hgroup>
        <h1>Users</h1>
        <p>Promoted users get admin rights the next time they log in.</p>
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
                  <td>{user.isAdmin ? 'Admin' : 'User'}</td>
                  <td>
                    {!user.isAdmin && (
                      <button type="button" onClick={() => promote(user.id)}>
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
