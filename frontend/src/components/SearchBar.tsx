import type { FormEvent } from 'react'
import { useNavigate } from 'react-router'

interface SearchBarProps {
  initialQuery: string
}

export default function SearchBar({ initialQuery }: SearchBarProps) {
  const navigate = useNavigate()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const query = String(new FormData(event.currentTarget).get('q') ?? '').trim()
    if (query) navigate(`/search?q=${encodeURIComponent(query)}`)
  }

  return (
    <form role="search" onSubmit={handleSubmit}>
      <input type="search" name="q" aria-label="Search journal" placeholder="Search…" defaultValue={initialQuery} />
      <button type="submit">Search</button>
    </form>
  )
}
