import { useRef } from 'react'
import { Link, Outlet } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import BuildInfo from './BuildInfo'
import Wordmark from './Wordmark'

export default function Layout() {
  const { user, logout } = useAuth()
  const menuRef = useRef<HTMLDetailsElement>(null)

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
                    <Link to="/history" onClick={closeMenu}>
                      History
                    </Link>
                  </li>
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
