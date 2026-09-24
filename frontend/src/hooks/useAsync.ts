import { useCallback, useEffect, useState, type DependencyList } from 'react'
import { errorMessage } from '../utils/errors'

interface AsyncState<T> {
  data: T | undefined
  error: string | null
  loading: boolean
}

export interface AsyncResult<T> extends AsyncState<T> {
  /** Loads the data again, e.g. after saving a change. */
  reload: () => void
}

/**
 * Runs `load` whenever `deps` change and tracks its result. Responses that arrive after the
 * deps have changed (or the component unmounted) are ignored.
 */
export function useAsync<T>(load: () => Promise<T>, deps: DependencyList): AsyncResult<T> {
  const [state, setState] = useState<AsyncState<T>>({ data: undefined, error: null, loading: true })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let current = true
    setState((previous) => ({ ...previous, loading: true }))

    load().then(
      (data) => current && setState({ data, error: null, loading: false }),
      (error: unknown) => current && setState({ data: undefined, error: errorMessage(error), loading: false }),
    )

    return () => {
      current = false
    }
    // `load` is recreated every render; the caller's deps describe when it actually changes.
  }, [...deps, version])

  const reload = useCallback(() => setVersion((v) => v + 1), [])
  return { ...state, reload }
}
