import { useRef, useState } from 'react'
import type { EntryCategory } from '../api/types'
import SubEntryForm from './SubEntryForm'

interface Draft {
  id: number
  label: string
  category: EntryCategory
  placeholder?: string
}

type DraftTemplate = Omit<Draft, 'id'>

// Two good boxes to one bad box nudges toward a positive ratio. Each box's category can still be changed.
const NUDGE_DRAFTS: readonly DraftTemplate[] = [
  { label: 'Good thing 1', category: 'Good', placeholder: 'Something that went well…' },
  { label: 'Good thing 2', category: 'Good', placeholder: 'Something else you are grateful for…' },
  { label: 'Bad thing', category: 'Bad', placeholder: 'Something that could have gone better…' },
]

const BLANK_DRAFT: DraftTemplate = { label: 'New entry', category: 'Good' }

interface EntryDraftsProps {
  /** Starts with the good/good/bad boxes instead of a single blank one. */
  nudge: boolean
  onAdd: (category: EntryCategory, content: string) => Promise<void>
}

/**
 * Boxes for writing today's entries, each saved on its own. A saved box disappears; once all are saved a
 * blank one takes their place, so any number of entries can be added.
 */
export default function EntryDrafts({ nudge, onAdd }: EntryDraftsProps) {
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    (nudge ? NUDGE_DRAFTS : [BLANK_DRAFT]).map((draft, id) => ({ ...draft, id })),
  )
  const nextId = useRef(drafts.length)

  async function save(id: number, category: EntryCategory, content: string) {
    await onAdd(category, content)
    const blank: Draft = { ...BLANK_DRAFT, id: nextId.current++ }
    setDrafts((previous) => {
      const remaining = previous.filter((draft) => draft.id !== id)
      return remaining.length > 0 ? remaining : [blank]
    })
  }

  return drafts.map((draft) => (
    <SubEntryForm
      key={draft.id}
      initial={{ category: draft.category, content: '' }}
      contentLabel={draft.label}
      placeholder={draft.placeholder}
      submitLabel="Add entry"
      onSubmit={(category, content) => save(draft.id, category, content)}
    />
  ))
}
