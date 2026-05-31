import { useEffect, useState } from 'react'

const emptyTemplate = {
  name: '',
  type: 'email',
  body: '',
}

const typeBadgeClasses = {
  email: 'bg-blue-100 text-blue-700',
  dm: 'bg-purple-100 text-purple-700',
}

function previewBody(body) {
  if (!body) {
    return ''
  }

  return body.length > 120 ? `${body.slice(0, 120)}…` : body
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyTemplate)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function loadTemplates() {
      setLoading(true)
      const response = await fetch('/api/templates')
      const data = response.ok ? await response.json() : []

      if (active) {
        setTemplates(data)
        setLoading(false)
      }
    }

    loadTemplates()

    return () => {
      active = false
    }
  }, [])

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')

    const response = await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    if (response.ok) {
      const createdTemplate = await response.json()
      setTemplates((current) => [createdTemplate, ...current])
      setForm(emptyTemplate)
      setShowForm(false)
    } else {
      setError('Unable to create template')
    }

    setSaving(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Templates</h1>
          <p className="mt-1 text-sm text-gray-500">Create reusable email and DM outreach messages.</p>
        </div>
        <button type="button" onClick={() => setShowForm((current) => !current)} className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white transition-colors hover:bg-gray-800">
          {showForm ? 'Cancel' : 'New Template'}
        </button>
      </div>

      {showForm ? (
        <form onSubmit={handleSubmit} className="mb-6 rounded-md border border-gray-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Name</span>
              <input
                type="text"
                required
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Type</span>
              <select
                value={form.type}
                onChange={(event) => updateField('type', event.target.value)}
                className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none"
              >
                <option value="email">Email</option>
                <option value="dm">DM</option>
              </select>
            </label>
          </div>

          <label className="mt-4 block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Body</span>
            <textarea
              required
              value={form.body}
              onChange={(event) => updateField('body', event.target.value)}
              rows="6"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none"
            />
          </label>
          <p className="mt-1 text-xs text-gray-500">Use {'{contact_name}'}, {'{school_name}'}, {'{role}'} as placeholders.</p>

          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

          <button type="submit" disabled={saving} className="mt-4 rounded bg-gray-900 px-3 py-1.5 text-sm text-white transition-colors hover:bg-gray-800 disabled:bg-gray-400">
            {saving ? 'Saving...' : 'Create Template'}
          </button>
        </form>
      ) : null}

      {loading ? <p className="text-sm text-gray-500">Loading templates...</p> : null}

      {!loading && templates.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">No templates yet.</div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {templates.map((template) => (
          <article key={template.id} className="rounded-md border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2 className="font-semibold text-gray-900">{template.name}</h2>
              <span className={`rounded px-2 py-0.5 text-xs font-medium uppercase ${typeBadgeClasses[template.type] || typeBadgeClasses.email}`}>{template.type}</span>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-6 text-gray-600">{previewBody(template.body)}</p>
          </article>
        ))}
      </div>
    </div>
  )
}
