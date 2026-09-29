import { useRef } from 'react'
import { Link, Outlet, useLocation, useSearchParams } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import SearchBar from './SearchBar'
import Wordmark from './Wordmark'

const ACCOUNT_PAGES = ['/settings', '/admin']

export default function Layout() {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const currentQuery = pathname === '/search' ? (searchParams.get('q') ?? '') : ''
  const menuRef = useRef<HTMLDetailsElement>(null)
  // Account pages hold no journal content, so searching from them is left out.
  const showSearch = !ACCOUNT_PAGES.includes(pathname)

  // The header stays mounted across pages, so the menu has to be closed after choosing an item.
  function closeMenu() {
    if (menuRef.current) menuRef.current.open = false
  }

  return (
    <>
      <header>
        <nav>
          <ul>
            <li>
              <Link to="/">
                <Wordmark />
              </Link>
            </li>
          </ul>
          <ul>
            <li>
              <details className="dropdown" ref={menuRef}>
                <summary>{user?.username}</summary>
                {/* rtl opens the menu leftwards, so it stays on screen at the right edge of the nav. */}
                <ul dir="rtl">
                  <li>
                    <Link to="/settings" onClick={closeMenu}>
                      Settings
                    </Link>
                  </li>
                  {user?.role === 'Admin' && (
                    <li>
                      <Link to="/admin" onClick={closeMenu}>
                        Admin
                      </Link>
                    </li>
                  )}
                  <li>
                    {/* Only a deliberate logout resets the URL; an expired session keeps it so re-login returns there. */}
                    <Link to="/" onClick={logout}>
                      Log out
                    </Link>
                  </li>
                </ul>
              </details>
            </li>
          </ul>
        </nav>
        {/* Keyed by the query so the box shows the current search after navigating. */}
        {showSearch && <SearchBar key={currentQuery} initialQuery={currentQuery} />}
      </header>
      <main>
        <Outlet />
      </main>
    </>
  )
}
