import { Link, Outlet, useLocation, useSearchParams } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import SearchBar from './SearchBar'

export default function Layout() {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const currentQuery = pathname === '/search' ? (searchParams.get('q') ?? '') : ''

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
            {user?.isAdmin && (
              <li>
                <Link to="/admin">Admin</Link>
              </li>
            )}
            <li>
              <button type="button" onClick={logout} title={`Signed in as ${user?.username}`}>
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
