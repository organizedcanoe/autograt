import { Link, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import SearchBar from './SearchBar'
import ThemePicker from './ThemePicker'

export default function Layout() {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const currentQuery = pathname === '/search' ? (searchParams.get('q') ?? '') : ''

  // Only a deliberate logout resets the URL; an expired session keeps it so re-login returns there.
  function handleLogout() {
    navigate('/')
    logout()
  }

  return (
    <>
      <header>
        <nav>
          <ul>
            <li>
              <strong>
                <Link to="/">Autograt</Link>
              </strong>
            </li>
          </ul>
          <ul>
            <ThemePicker />
            {user?.isAdmin && (
              <li>
                <Link to="/admin">Admin</Link>
              </li>
            )}
            <li>
              <button type="button" onClick={handleLogout} title={`Signed in as ${user?.username}`}>
                Log out
              </button>
            </li>
          </ul>
        </nav>
        {/* Keyed by the query so the box shows the current search after navigating. */}
        <SearchBar key={currentQuery} initialQuery={currentQuery} />
      </header>
      <main>
        <Outlet />
      </main>
    </>
  )
}
