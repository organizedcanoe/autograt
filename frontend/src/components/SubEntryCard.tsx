import type { SubEntry } from '../api/types'
import { formatTime } from '../utils/dates'
import AppendForm from './AppendForm'

interface SubEntryCardProps {
  subEntry: SubEntry
  onAppend: (subEntryId: number, content: string) => Promise<void>
}

/** A sub-entry tagged with its category, its appended notes in order, and a form to append another. */
export default function SubEntryCard({ subEntry, onAppend }: SubEntryCardProps) {
  return (
    <article>
      <header>
        <strong>{subEntry.category}</strong> ·{' '}
        <small>
          <time dateTime={subEntry.createdAtUtc}>{formatTime(subEntry.createdAtUtc)}</time>
        </small>
      </header>
      <p>{subEntry.content}</p>
      {subEntry.appends.length > 0 && (
        <ul>
          {subEntry.appends.map((append) => (
            <li key={append.id}>
              <small>
                <time dateTime={append.createdAtUtc}>{formatTime(append.createdAtUtc)}</time>
              </small>{' '}
              — {append.content}
            </li>
          ))}
        </ul>
      )}
      <footer>
        <AppendForm subEntryId={subEntry.id} onSubmit={onAppend} />
      </footer>
    </article>
  )
}
