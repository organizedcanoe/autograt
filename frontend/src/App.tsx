import { useEffect, useState } from 'react'

type HealthResponse = {
  status: string
}

export default function App() {
  const [apiStatus, setApiStatus] = useState<string>('checking...')

  useEffect(() => {
    fetch('/api/health')
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json() as Promise<HealthResponse>
      })
      .then((health) => setApiStatus(health.status))
      .catch(() => setApiStatus('unavailable'))
  }, [])

  return (
    <main>
      <h1>Autograt</h1>
      <p>API status: {apiStatus}</p>
    </main>
  )
}
