import { useRef, useState, type FormEvent } from 'react'
import { api, ApiError } from '../api/client'
import type { ExportFormat, ImportResult } from '../api/types'
import { saveFile } from '../utils/download'
import { errorMessage } from '../utils/errors'
import Alert from './Alert'

interface Props {
  /** Called after a successful import, so the page can pick up the imported settings. */
  onImported: () => void
}

interface ImportFileSettings {
  settings?: { setting?: string; values?: string[] }[]
}

interface Outcome {
  result: ImportResult
  remindersOn: boolean
}

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

/** True when the file's settings turn reminders on, which each device must then allow again. */
function turnsRemindersOn(file: unknown) {
  const settings = (file as ImportFileSettings | null)?.settings
  return Array.isArray(settings) && settings.some((s) => s.setting === 'RemindersEnabled' && s.values?.[0] === 'on')
}

/** Exports the user's journal, and imports a JSON export back in, replacing the days it contains. */
export default function DataSettings({ onImported }: Props) {
  const form = useRef<HTMLFormElement>(null)
  const [exporting, setExporting] = useState<ExportFormat | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  // The parsed file, waiting for the user to confirm the import.
  const [pending, setPending] = useState<unknown>(undefined)
  const [importing, setImporting] = useState(false)
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  async function download(format: ExportFormat) {
    setExporting(format)
    setExportError(null)
    try {
      const exported = await api.exportJournal(format)
      saveFile(exported.blob, exported.fileName)
    } catch (e) {
      setExportError(`Your journal could not be exported: ${errorMessage(e)}`)
    } finally {
      setExporting(null)
    }
  }

  async function confirmImport(e: FormEvent) {
    e.preventDefault()
    if (!file) return
    setImportErrors([])
    setOutcome(null)
    try {
      setPending(JSON.parse(await file.text()))
    } catch {
      setImportErrors(['This file is not a JSON export.'])
    }
  }

  async function runImport() {
    const parsed = pending
    setPending(undefined)
    setImporting(true)
    try {
      const result = await api.importJournal(parsed)
      setOutcome({ result, remindersOn: turnsRemindersOn(parsed) })
      form.current?.reset()
      setFile(null)
      onImported()
    } catch (e) {
      setImportErrors(e instanceof ApiError ? e.details : [errorMessage(e)])
    } finally {
      setImporting(false)
    }
  }

  return (
    <section>
      <h2>Your data</h2>
      <p>Download your journal and settings. Only the JSON export can be imported again.</p>
      <div role="group">
        <button type="button" disabled={exporting !== null} aria-busy={exporting === 'json'} onClick={() => void download('json')}>
          Export as JSON
        </button>
        <button
          type="button"
          className="secondary"
          disabled={exporting !== null}
          aria-busy={exporting === 'markdown'}
          onClick={() => void download('markdown')}
        >
          Export as Markdown
        </button>
      </div>
      {exportError && <Alert kind="error">{exportError}</Alert>}

      <form ref={form} onSubmit={(e) => void confirmImport(e)}>
        <label>
          Journal import (JSON)
          <input
            type="file"
            accept="application/json,.json"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <button type="submit" disabled={!file || importing} aria-busy={importing}>
          Import
        </button>
      </form>

      {importErrors.length > 0 && (
        <Alert kind="error">
          <p>Your journal could not be imported:</p>
          <ul>
            {importErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </Alert>
      )}

      {outcome && (
        <Alert kind="success">
          <p>
            {plural(outcome.result.importedDays, 'day')} imported ({outcome.result.replacedDays.length} replaced) and{' '}
            {plural(outcome.result.settingsImported, 'setting')}.
            {outcome.remindersOn && ' Reminders are on in the imported settings; enable them on this device in the Reminders section above.'}
          </p>
          {outcome.result.replacedDays.length > 0 && (
            <details>
              <summary>Replaced days</summary>
              <ul>
                {outcome.result.replacedDays.map((date) => (
                  <li key={date}>{date}</li>
                ))}
              </ul>
            </details>
          )}
        </Alert>
      )}

      {pending !== undefined && (
        <dialog open>
          <article>
            <h3>Overwrite matching dates?</h3>
            <p>
              Importing will overwrite your entries and ratings on any dates that are also in this file. Entries and
              ratings on dates not in the file will be kept. Settings in the file will replace yours. This cannot be
              undone.
            </p>
            <footer>
              <button type="button" className="secondary" onClick={() => setPending(undefined)}>
                Cancel
              </button>
              <button type="button" onClick={() => void runImport()}>
                Replace and import
              </button>
            </footer>
          </article>
        </dialog>
      )}
    </section>
  )
}
