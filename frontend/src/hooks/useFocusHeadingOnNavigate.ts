import { useEffect, useRef, type RefObject } from 'react'
import { useLocation } from 'react-router'

/**
 * After each navigation, moves focus to the new page's `<h1>` (or the main element itself, while the heading
 * hasn't rendered), so screen readers announce the page and the next Tab starts from its content. The first page
 * keeps the browser's own focus.
 */
export function useFocusHeadingOnNavigate(mainRef: RefObject<HTMLElement | null>): void {
  const { pathname } = useLocation()
  const previousPathname = useRef(pathname)

  useEffect(() => {
    if (pathname === previousPathname.current) return
    previousPathname.current = pathname

    const main = mainRef.current
    const target = main?.querySelector('h1') ?? main
    if (!target) return
    // -1 makes the heading focusable from script without adding it to the tab order.
    target.setAttribute('tabindex', '-1')
    target.focus()
  }, [pathname, mainRef])
}
