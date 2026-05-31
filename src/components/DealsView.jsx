import { useEffect, useMemo, useState } from 'react'
import DealDetail from './DealDetail.jsx'

const stages = ['Prospecting', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost']

const stageBadgeClasses = {
  Prospecting: 'bg-gray-100 text-gray-700',
  Proposal: 'bg-blue-100 text-blue-700',
  Negotiation: 'bg-amber-100 text-amber-700',
  'Closed Won': 'bg-emerald-100 text-emerald-700',
  'Closed Lost': 'bg-red-100 text-red-700',
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === '') {
    return '—'
  }

  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value))
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : '—'
}

function deriveSchools(contacts) {
  const schoolMap = new Map()

  contacts.forEach((contact) => {
    if (contact.school_id && !schoolMap.has(contact.school_id)) {
      schoolMap.set(contact.school_id, { id: contact.school_id, name: contact.school_name || 'Unknown School' })
    }
  })

  return Array.from(schoolMap.values()).sort((a, b) => a.name.localeCompare(b.name))
}

const emptyForm = {
  title: '',
  school_id: '',
  contact_id: '',
  stage: 'Prospecting',
  value: '',
  close_date: '',
}

function DealForm({ schools, contacts, onCancel, onCreated }) {
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const filteredContacts = contacts.filter((contact) => !form.school_id || contact.school_id === form.school_id)

  function updateField(field, value) {
    setForm((current) => {
      const next = { ...current, [field]: value }

      if (field === 'school_id') {
        next.contact_id = ''
      }

      return next
    })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')

    const selectedSchool = schools.find((school) => school.id === form.school_id)
    const selectedContact = contacts.find((contact) => contact.id === form.contact_id)
    const response = await fetch('/api/deals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        school_id: form.school_id || null,
        contact_id: form.contact_id || null,
        title: form.title,
        value: form.value === '' ? null : form.value,
        stage: form.stage,
        close_date: form.close_date || null,
        notes: '',
      }),
    })

    if (response.ok) {
      const createdDeal = await response.json()
      onCreated({
        ...createdDeal,
        school_name: selectedSchool?.name || selectedContact?.school_name || '',
        contact_name: selectedContact?.name || '',
      })
    } else {
      setError('Unable to create deal')
      setSaving(false)
    }
  }

  return (
    <aside className="w-[420px] flex-shrink-0 border-l border-gray-200 bg-white p-6 min-h-screen">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-gray-900">New Deal</h2>
        <button type="button" onClick={onCancel} className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50">
          Cancel
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Title</span>
          <input
            type="text"
            required
            value={form.title}
            onChange={(event) => updateField('title', event.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">School</span>
          <select
            value={form.school_id}
            onChange={(event) => updateField('school_id', event.target.value)}
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none"
          >
            <option value="">Select school</option>
            {schools.map((school) => (
              <option key={school.id} value={school.id}>{school.name}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Contact</span>
          <select
            value={form.contact_id}
            onChange={(event) => updateField('contact_id', event.target.value)}
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none"
          >
            <option value="">Select contact</option>
            {filteredContacts.map((contact) => (
              <option key={contact.id} value={contact.id}>{contact.name}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Stage</span>
          <select
            value={form.stage}
            onChange={(event) => updateField('stage', event.target.value)}
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none"
          >
            {stages.map((stage) => (
              <option key={stage} value={stage}>{stage}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Value</span>
          <input
            type="number"
            min="0"
            value={form.value}
            onChange={(event) => updateField('value', event.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Close Date</span>
          <input
            type="date"
            value={form.close_date}
            onChange={(event) => updateField('close_date', event.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none"
          />
        </label>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button type="submit" disabled={saving} className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white transition-colors hover:bg-gray-800 disabled:bg-gray-400">
          {saving ? 'Saving...' : 'Create Deal'}
        </button>
      </form>
    </aside>
  )
}

export { stageBadgeClasses, stages, formatCurrency, formatDate }

export default function DealsView() {
  const [deals, setDeals] = useState([])
  const [selectedDeal, setSelectedDeal] = useState(null)
  const [showNewDealForm, setShowNewDealForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [schools, setSchools] = useState([])
  const [contacts, setContacts] = useState([])

  useEffect(() => {
    let active = true

    async function loadDeals() {
      setLoading(true)
      const [dealsResponse, contactsResponse] = await Promise.all([fetch('/api/deals'), fetch('/api/contacts')])
      const dealsData = dealsResponse.ok ? await dealsResponse.json() : []
      const contactsData = contactsResponse.ok ? await contactsResponse.json() : []

      if (active) {
        setDeals(dealsData)
        setContacts(contactsData)
        setSchools(deriveSchools(contactsData))
        setLoading(false)
      }
    }

    loadDeals()

    return () => {
      active = false
    }
  }, [])

  const selectedPanelDeal = useMemo(() => deals.find((deal) => selectedDeal && deal.id === selectedDeal.id) || selectedDeal, [deals, selectedDeal])

  function handleDealUpdated(updatedDeal) {
    setDeals((current) => current.map((deal) => (deal.id === updatedDeal.id ? { ...deal, ...updatedDeal } : deal)))
    setSelectedDeal((current) => (current && current.id === updatedDeal.id ? { ...current, ...updatedDeal } : current))
  }

  function handleDealDeleted(dealId) {
    setDeals((current) => current.filter((deal) => deal.id !== dealId))
    setSelectedDeal(null)
  }

  function handleDealCreated(createdDeal) {
    setDeals((current) => [createdDeal, ...current])
    setShowNewDealForm(false)
  }

  return (
    <div className="flex min-h-screen bg-white">
      <section className="min-w-0 flex-1 p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-gray-900">Deals</h1>
          <button
            type="button"
            onClick={() => {
              setSelectedDeal(null)
              setShowNewDealForm(true)
            }}
            className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white transition-colors hover:bg-gray-800"
          >
            New Deal
          </button>
        </div>

        <div className="border border-gray-200 overflow-hidden bg-white">
          <table className="min-w-full text-left">
            <thead className="sticky top-0 z-10 border-b border-gray-300 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr className="h-9">
                <th className="border-r border-gray-200 px-3 py-1.5 font-semibold">Title</th>
                <th className="border-r border-gray-200 px-3 py-1.5 font-semibold">School</th>
                <th className="border-r border-gray-200 px-3 py-1.5 font-semibold">Contact</th>
                <th className="border-r border-gray-200 px-3 py-1.5 font-semibold">Stage</th>
                <th className="border-r border-gray-200 px-3 py-1.5 font-semibold">Value</th>
                <th className="px-3 py-1.5 font-semibold">Close Date</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {loading ? (
                <tr className="h-9 border-b border-gray-200"><td colSpan="6" className="px-3 py-1.5 text-center text-[13px] text-gray-500">Loading deals...</td></tr>
              ) : deals.length === 0 ? (
                <tr className="h-9 border-b border-gray-200"><td colSpan="6" className="px-3 py-1.5 text-center text-[13px] text-gray-500">No deals found.</td></tr>
              ) : (
                deals.map((deal) => (
                  <tr
                    key={deal.id}
                    onClick={() => {
                      setShowNewDealForm(false)
                      setSelectedDeal(deal)
                    }}
                    className={`h-9 cursor-pointer border-b border-gray-200 transition-colors hover:bg-gray-50/80 ${selectedDeal?.id === deal.id ? 'bg-blue-50' : ''}`}
                  >
                    <td className="border-r border-gray-200 px-3 py-1.5 text-[13px] font-medium text-gray-900">{deal.title}</td>
                    <td className="border-r border-gray-200 px-3 py-1.5 text-[13px] text-gray-500">{deal.school_name || '—'}</td>
                    <td className="border-r border-gray-200 px-3 py-1.5 text-[13px] text-gray-500">{deal.contact_name || '—'}</td>
                    <td className="border-r border-gray-200 px-3 py-1.5"><span className={`rounded px-2 py-0.5 text-xs font-medium ${stageBadgeClasses[deal.stage] || stageBadgeClasses.Prospecting}`}>{deal.stage}</span></td>
                    <td className="border-r border-gray-200 px-3 py-1.5 text-[13px] text-gray-900">{formatCurrency(deal.value)}</td>
                    <td className="px-3 py-1.5 text-[13px] text-gray-500">{formatDate(deal.close_date)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showNewDealForm ? <DealForm schools={schools} contacts={contacts} onCancel={() => setShowNewDealForm(false)} onCreated={handleDealCreated} /> : null}
      {selectedPanelDeal && !showNewDealForm ? (
        <DealDetail deal={selectedPanelDeal} onClose={() => setSelectedDeal(null)} onDealUpdated={handleDealUpdated} onDealDeleted={handleDealDeleted} />
      ) : null}
    </div>
  )
}
