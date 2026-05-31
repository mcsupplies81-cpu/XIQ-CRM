import { useEffect, useState } from 'react'

const emptyTemplate = { name: '', type: 'email', body: '' }

const typeBadgeClasses = {
  email: 'bg-blue-100 text-blue-700',
  dm: 'bg-purple-100 text-purple-700',
}

function previewBody(body) {
  if (!body) return ''
  return body.length > 120 ? `${body.slice(0, 120)}…` : body
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState(null)
  const [form, setForm] = useState(emptyTemplate)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [copiedId, setCopiedId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

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
    return () => { active = false }
  }, [])

  function openNewForm() {
    setEditingTemplate(null)
    setForm(emptyTemplate)
    setShowForm(true)
    setError('')
  }

  function openEditForm(template) {
    setEditingTemplate(template)
    setForm({ name: template.name, type: template.type, body: template.body })
    setShowForm(true)
    setError('')
  }

  function cancelForm() {
    setShowForm(false)
    setEditingTemplate(null)
    setForm(emptyTemplate)
    setError('')
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')

    if (editingTemplate) {
      const response = await fetch(`/api/templates/${editingTemplate.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (response.ok) {
        const updated = await response.json()
        setTemplates((current) => current.map((t) => (t.id === updated.id ? updated : t)))
        cancelForm()
      } else {
        setError('Unable to update template')
      }
    } else {
      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (response.ok) {
        const created = await response.json()
        setTemplates((current) => [created, ...current])
        cancelForm()
      } else {
        setError('Unable to create template')
      }
    }

    setSaving(false)
  }

  async function handleDelete(template) {
    setDeletingId(template.id)
    const response = await fetch(`/api/templates/${template.id}`, { method: 'DELETE' })
    if (response.ok) {
      setTemplates((current) => current.filter((t) => t.id !== template.id))
      if (editingTemplate?.id === template.id) cancelForm()
    }
    setDeletingId(null)
  }

  async function handleCopy(template) {
    await navigator.clipboard.writeText(template.body)
    setCopiedId(template.id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Templates</h1>
          <p className="mt-1 text-sm text-gray-500">Reusable email and DM outreach messages.</p>
        </div>
        <button type="button" onClick={showForm ? cancelForm : openNewForm} className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white transition-colors hover:bg-gray-800">
          {showForm ? 'Cancel' : 'New Template'}
        </button>
      </div>

      {showForm ? (
        <form onSubmit={handleSubmit} className="mb-6 rounded-md border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">{editingTemplate ? 'Edit template' : 'New template'}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Name</span>
              <input type="text" required value={form.name} onChange={(e) => updateField('name', e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Type</span>
              <select value={form.type} onChange={(e) => updateField('type', e.target.value)} className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none">
                <option value="email">Email</option>
                <option value="dm">DM</option>
              </select>
            </label>
          </div>
          <label className="mt-4 block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Body</span>
            <textarea required value={form.body} onChange={(e) => updateField('body', e.target.value)} rows="6" className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none" />
          </label>
          <p className="mt-1 text-xs text-gray-500">Use {'{contact_name}'}, {'{school_name}'}, {'{role}'} as placeholders.</p>
          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
          <div className="mt-4 flex items-center gap-3">
            <button type="submit" disabled={saving} className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white transition-colors hover:bg-gray-800 disabled:bg-gray-400">
              {saving ? 'Saving...' : editingTemplate ? 'Save changes' : 'Create Template'}
            </button>
            {editingTemplate && (
              <button
                type="button"
                onClick={() => handleDelete(editingTemplate)}
                disabled={deletingId === editingTemplate.id}
                className="ml-auto rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                {deletingId === editingTemplate.id ? 'Deleting...' : 'Delete template'}
              </button>
            )}
          </div>
        </form>
      ) : null}

      {loading ? <p className="text-sm text-gray-500">Loading templates...</p> : null}

      {!loading && templates.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">No templates yet. Create one above.</div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {templates.map((template) => (
          <article key={template.id} className="rounded-md border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2 className="font-semibold text-gray-900">{template.name}</h2>
              <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium uppercase ${typeBadgeClasses[template.type] || typeBadgeClasses.email}`}>{template.type}</span>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-6 text-gray-600">{previewBody(template.body)}</p>
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleCopy(template)}
                className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                {copiedId === template.id ? 'Copied!' : 'Copy'}
              </button>
              <button
                type="button"
                onClick={() => openEditForm(template)}
                className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => handleDelete(template)}
                disabled={deletingId === template.id}
                className="rounded border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
              >
                {deletingId === template.id ? '...' : 'Delete'}
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
