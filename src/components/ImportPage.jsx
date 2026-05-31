import { useState } from 'react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'

const columnMap = {
  name: 'name',
  school: 'school_name',
  school_name: 'school_name',
  city: 'city',
  state: 'state',
  role: 'role',
  email: 'email',
  phone: 'phone',
  x_handle: 'x_handle',
  x: 'x_handle',
}

function normalizeHeader(header) {
  return header.toLowerCase().trim().replace(/\s+/g, '_')
}

function normalizeRow(row) {
  return Object.entries(row).reduce((normalized, [key, value]) => {
    const mappedKey = columnMap[normalizeHeader(key)]

    if (mappedKey) {
      normalized[mappedKey] = typeof value === 'string' ? value.trim() : value
    }

    return normalized
  }, {})
}

function parseCsv(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data.map(normalizeRow)),
      error: reject,
    })
  })
}

async function parseXlsx(file) {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
  return rows.map(normalizeRow)
}

export default function ImportPage() {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleFileChange(event) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const extension = file.name.split('.').pop()?.toLowerCase()
      const rows = extension === 'csv' ? await parseCsv(file) : await parseXlsx(file)
      const response = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      })

      if (!response.ok) {
        throw new Error('Import failed')
      }

      setResult(await response.json())
    } catch (importError) {
      setError(importError.message || 'Import failed')
    } finally {
      setLoading(false)
      event.target.value = ''
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-gray-900">Import</h1>
      </div>

      <div className="max-w-lg rounded-md border border-gray-200 bg-white p-6">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-gray-900">Contact file</span>
          <input
            type="file"
            accept=".csv,.xlsx"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-900 file:mr-3 file:rounded file:border-0 file:bg-gray-900 file:px-3 file:py-1.5 file:text-sm file:text-white"
          />
        </label>

        {loading ? <p className="mt-4 text-sm text-gray-500">Importing...</p> : null}
        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        {result ? (
          <p className="mt-4 text-sm text-gray-900">
            {result.imported} imported, {result.skipped} skipped, {result.errors?.length || 0} errors
          </p>
        ) : null}
      </div>
    </div>
  )
}
