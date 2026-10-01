import { useRef } from 'react'
import { Link, Outlet, useLocation } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import BuildInfo from './BuildInfo'
import SearchBar from './SearchBar'
import Wordmark from './Wordmark'

// Account pages hold no journal content, and the search page has its own search bar.
const PAGES_WITHOUT_HEADER_SEARCH = ['/settings', '/admin', '/search']

export default function Layout() {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  const menuRef = useRef<HTMLDetailsElement>(null)
  const showSearch = !PAGES_WITHOUT_HEADER_SEARCH.includes(pathname)

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
              <Link to="/search">Search</Link>
            </li>
            <li>
              <details className="dropdown" ref={menuRef}>
                <summary>{user?.username}</summary>
                {/* rtl opens the menu leftwards, so it stays on screen at the right edge of the nav. */}
                <ul dir="rtl">
                  <li>
                    <Link to="/search" onClick={closeMenu}>
                      Search
                    </Link>
                  </li>
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
        {showSearch && <SearchBar initialQuery="" />}
      </header>
      <main>
        <Outlet />
      </main>
      <footer>
        <BuildInfo />
      </footer>
    </>
  )
}
