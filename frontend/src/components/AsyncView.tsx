import type { ReactNode } from 'react'
import type { AsyncResult } from '../hooks/useAsync'

interface AsyncViewProps<T> {
  state: AsyncResult<T>
  children: (data: T) => ReactNode
}

/** Renders the error, a loading indicator, or the loaded data. */
export default function AsyncView<T>({ state, children }: AsyncViewProps<T>) {
  if (state.error) return <p role="alert">{state.error}</p>
  if (state.data === undefined) return <p aria-busy="true">Loading…</p>
  return children(state.data)
}
