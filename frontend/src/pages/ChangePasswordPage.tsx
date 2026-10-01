import { useAuth } from '../auth/AuthContext'
import ChangePasswordForm from '../components/ChangePasswordForm'
import Wordmark from '../components/Wordmark'

/** Shown instead of the app after an admin reset the user's password, until they choose a new one. */
export default function ChangePasswordPage() {
  const { logout } = useAuth()

  return (
    <main>
      <hgroup>
        <h1>
          <Wordmark />
        </h1>
        <p>A daily gratitude journal</p>
      </hgroup>
      <article>
        <hgroup>
          <h2>Choose a new password</h2>
          <p>An admin reset your password. Choose a new one to keep using Autograt.</p>
        </hgroup>
        <ChangePasswordForm currentPasswordLabel="Temporary password" />
        <footer>
          <button type="button" className="secondary" onClick={logout}>
            Log out
          </button>
        </footer>
      </article>
    </main>
  )
}
