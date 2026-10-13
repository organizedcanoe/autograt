import { useRef, useState, type KeyboardEvent } from 'react'

/** The roving focus props for one grid item. */
export type GridItemProps = ReturnType<ReturnType<typeof useGridNavigation>>

/**
 * Roving focus over a grid of `count` items laid out in rows of `columns`: the grid is one tab stop (the last
 * item, e.g. today, until another is focused), the arrow keys move by item and by row, and Home and End jump to
 * the first and last item. Spread `itemProps(index)` onto each item.
 */
export function useGridNavigation(count: number, columns: number) {
  const [active, setActive] = useState(count - 1)
  const items = useRef<(HTMLOrSVGElement | null)[]>([])
  const tabStop = Math.min(active, count - 1)

  function target(key: string, index: number): number | null {
    switch (key) {
      case 'ArrowLeft':
        return index - 1
      case 'ArrowRight':
        return index + 1
      case 'ArrowUp':
        return index - columns
      case 'ArrowDown':
        return index + columns
      case 'Home':
        return 0
      case 'End':
        return count - 1
      default:
        return null
    }
  }

  return function itemProps(index: number) {
    return {
      tabIndex: index === tabStop ? 0 : -1,
      ref: (element: HTMLOrSVGElement | null) => {
        items.current[index] = element
      },
      onFocus: () => setActive(index),
      onKeyDown: (event: KeyboardEvent) => {
        const next = target(event.key, index)
        if (next === null) return
        event.preventDefault()
        // Moves past either end are ignored, so focus stays put.
        if (next >= 0 && next < count) items.current[next]?.focus()
      },
    }
  }
}
