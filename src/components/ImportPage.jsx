import { useState } from 'react'

export default function ImportPage() {
  const [rowsText, setRowsText] = useState('[\n  {\n    "name": "Jane Coach",\n    "school_name": "Central High",\n    "city": "Austin",\n    "state": "TX",\n    "role": "Athletic Director",\n    "email": "jane@example.com",\n    "phone": "555-0100",\n    "x_handle": "@janecoach"\n  }\n]')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [isImporting, setIsImporting] = useState(false)

  async function importRows(event) {
    event.preventDefault()
    setError('')
    setResult(null)
    setIsImporting(true)

    try {
      const rows = JSON.parse(rowsText)
      if (!Array.isArray(rows)) {
        throw new Error('Import data must be a JSON array')
      }

      const response = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      })

      if (!response.ok) {
        throw new Error('Unable to import contacts')
      }

      setResult(await response.json())
    } catch (importError) {
      setError(importError.message)
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <section className="panel">
      <div className="page-header compact">
        <div>
          <p className="eyebrow">Import</p>
          <h2>Import contacts</h2>
          <p className="muted">Paste a JSON array of contact rows to import into Neon.</p>
        </div>
      </div>

      <form className="stacked-form" onSubmit={importRows}>
        <label>
          Rows JSON
          <textarea value={rowsText} onChange={(event) => setRowsText(event.target.value)} rows="16" />
        </label>
        <button className="primary-button" type="submit" disabled={isImporting}>
          {isImporting ? 'Importing...' : 'Import rows'}
        </button>
      </form>

      {error ? <p className="error-text">{error}</p> : null}
      {result ? (
        <pre className="result-block">{JSON.stringify(result, null, 2)}</pre>
      ) : null}
    </section>
  )
}
