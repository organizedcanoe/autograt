import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from '../api/client'
import { saveFile } from '../utils/download'
import DataSettings from './DataSettings'

vi.mock('../api/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../api/client')>()
  return { ...original, api: { ...original.api, exportJournal: vi.fn(), importJournal: vi.fn() } }
})

vi.mock('../utils/download', () => ({ saveFile: vi.fn() }))

const exportFile = {
  format: 'autograt-export',
  version: 1,
  settings: [{ setting: 'ColourTheme', values: ['jade'] }],
  entries: [],
}

function jsonFile(content: unknown, name = 'autograt-billy-2026-09-30.json') {
  return new File([typeof content === 'string' ? content : JSON.stringify(content)], name, { type: 'application/json' })
}

function renderSettings() {
  const onImported = vi.fn()
  render(<DataSettings onImported={onImported} />)
  return onImported
}

async function chooseAndImport(file: File) {
  await userEvent.upload(screen.getByLabelText('Journal export (JSON)'), file)
  await userEvent.click(screen.getByRole('button', { name: 'Import' }))
}

describe('DataSettings', () => {
  beforeEach(() => {
    vi.mocked(api.exportJournal).mockResolvedValue({ blob: new Blob(['{}']), fileName: 'autograt-billy-2026-09-30.json' })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it.each([
    ['Export as JSON', 'json'],
    ['Export as Markdown', 'markdown'],
  ] as const)('%s downloads the export in that format', async (button, format) => {
    renderSettings()

    await userEvent.click(screen.getByRole('button', { name: button }))

    expect(api.exportJournal).toHaveBeenCalledWith(format)
    const exported = await vi.mocked(api.exportJournal).mock.results[0].value
    expect(saveFile).toHaveBeenCalledWith(exported.blob, exported.fileName)
  })

  it('reports an export that failed', async () => {
    vi.mocked(api.exportJournal).mockRejectedValue(new ApiError(500, 'Server error'))
    renderSettings()

    await userEvent.click(screen.getByRole('button', { name: 'Export as JSON' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Your journal could not be exported: Server error')
  })

  it('disables Import until a file is chosen', () => {
    renderSettings()

    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled()
  })

  it('warns that days will be replaced before importing, and can be cancelled', async () => {
    renderSettings()

    await chooseAndImport(jsonFile(exportFile))

    expect(screen.getByRole('dialog')).toHaveTextContent(/replace any days you already have on the same dates/)
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(api.importJournal).not.toHaveBeenCalled()
  })

  it('imports the file once confirmed, then shows the result and replaced days', async () => {
    vi.mocked(api.importJournal).mockResolvedValue({
      importedDays: 3,
      replacedDays: ['2026-09-28', '2026-09-29'],
      settingsImported: 1,
    })
    const onImported = renderSettings()

    await chooseAndImport(jsonFile(exportFile))
    await userEvent.click(screen.getByRole('button', { name: 'Replace and import' }))

    expect(api.importJournal).toHaveBeenCalledWith(exportFile)
    expect(await screen.findByRole('status')).toHaveTextContent('3 days imported (2 replaced) and 1 setting.')
    expect(screen.getByText('2026-09-28')).toBeInTheDocument()
    expect(screen.getByText('2026-09-29')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onImported).toHaveBeenCalledTimes(1)
  })

  it('reminds the user to enable reminders on this device when the import turned them on', async () => {
    vi.mocked(api.importJournal).mockResolvedValue({ importedDays: 0, replacedDays: [], settingsImported: 1 })
    renderSettings()

    await chooseAndImport(jsonFile({ ...exportFile, settings: [{ setting: 'RemindersEnabled', values: ['on'] }] }))
    await userEvent.click(screen.getByRole('button', { name: 'Replace and import' }))

    expect(await screen.findByRole('status')).toHaveTextContent(/enable them on this device/)
  })

  it('lists every problem the server found in the file, without reporting it as imported', async () => {
    vi.mocked(api.importJournal).mockRejectedValue(
      new ApiError(400, 'The first problem', ['The first problem', 'The second problem']),
    )
    const onImported = renderSettings()

    await chooseAndImport(jsonFile(exportFile))
    await userEvent.click(screen.getByRole('button', { name: 'Replace and import' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Your journal could not be imported')
    expect(alert).toHaveTextContent('The first problem')
    expect(alert).toHaveTextContent('The second problem')
    expect(onImported).not.toHaveBeenCalled()
  })

  it('rejects a file that is not JSON without calling the server', async () => {
    renderSettings()

    await chooseAndImport(jsonFile('# Autograt journal', 'journal.md'))

    expect(await screen.findByRole('alert')).toHaveTextContent('This file is not a JSON export.')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(api.importJournal).not.toHaveBeenCalled()
  })
})
