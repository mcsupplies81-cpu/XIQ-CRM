import { useEffect, useState } from 'react'
import { statusBadgeClasses } from './ContactList.jsx'

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

function formatLocation(city, state) {
  return [city, state].filter(Boolean).join(', ') || '—'
}

export default function SchoolDetail({ schoolId, onClose }) {
  const [school, setSchool] = useState(null)
  const [contacts, setContacts] = useState([])
  const [deals, setDeals] = useState([])
  const [notes, setNotes] = useState('')
  const [originalNotes, setOriginalNotes] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function loadSchool() {
      setLoading(true)
      const response = await fetch(`/api/schools/${schoolId}`)
      const data = response.ok ? await response.json() : { school: null, contacts: [], deals: [] }

      if (active) {
        setSchool(data.school)
        setContacts(data.contacts || [])
        setDeals(data.deals || [])
        setNotes(data.school?.notes || '')
        setOriginalNotes(data.school?.notes || '')
        setLoading(false)
      }
    }

    loadSchool()

    return () => {
      active = false
    }
  }, [schoolId])

  async function handleNotesBlur() {
    if (notes === originalNotes) {
      return
    }

    const previousNotes = originalNotes
    const response = await fetch(`/api/schools/${schoolId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    })

    if (response.ok) {
      setOriginalNotes(notes)
      setSchool((current) => (current ? { ...current, notes } : current))
    } else {
      setNotes(previousNotes)
    }
  }

  return (
    <aside className="w-[460px] flex-shrink-0 border-l border-gray-200 bg-white p-6 min-h-screen">
      {loading ? (
        <div className="text-sm text-gray-500">Loading school...</div>
      ) : school ? (
        <>
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{school.name}</h2>
              <p className="mt-1 text-sm text-gray-500">{formatLocation(school.city, school.state)}</p>
            </div>
            <button type="button" onClick={onClose} className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50">
              Close
            </button>
          </div>

          <section className="border-b border-gray-100 py-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">Contacts</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead className="border-b border-gray-200 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                  <tr className="h-9">
                    <th className="px-2 py-2 font-medium">Name</th>
                    <th className="px-2 py-2 font-medium">Role</th>
                    <th className="px-2 py-2 font-medium">Status</th>
                    <th className="px-2 py-2 font-medium">Phone</th>
                    <th className="px-2 py-2 font-medium">Email</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((contact) => (
                    <tr key={contact.id} className="h-10 border-b border-gray-100">
                      <td className="px-2 py-2 text-sm font-medium text-gray-900">{contact.name}</td>
                      <td className="px-2 py-2"><span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">{contact.role || '—'}</span></td>
                      <td className="px-2 py-2"><span className={`rounded px-2 py-0.5 text-xs font-medium ${statusBadgeClasses[contact.status || 'New'] || statusBadgeClasses.New}`}>{contact.status || 'New'}</span></td>
                      <td className="px-2 py-2 text-sm text-gray-500">{contact.phone || '—'}</td>
                      <td className="px-2 py-2 text-sm text-gray-500">{contact.email || '—'}</td>
                    </tr>
                  ))}
                  {contacts.length === 0 ? (
                    <tr className="h-10 border-b border-gray-100"><td colSpan="5" className="px-2 py-2 text-sm text-gray-500">No contacts yet.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="border-b border-gray-100 py-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">Deals</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead className="border-b border-gray-200 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                  <tr className="h-9">
                    <th className="px-2 py-2 font-medium">Title</th>
                    <th className="px-2 py-2 font-medium">Stage</th>
                    <th className="px-2 py-2 font-medium">Value</th>
                    <th className="px-2 py-2 font-medium">Close Date</th>
                  </tr>
                </thead>
                <tbody>
                  {deals.map((deal) => (
                    <tr key={deal.id} className="h-10 border-b border-gray-100">
                      <td className="px-2 py-2 text-sm font-medium text-gray-900">{deal.title}</td>
                      <td className="px-2 py-2"><span className={`rounded px-2 py-0.5 text-xs font-medium ${stageBadgeClasses[deal.stage] || stageBadgeClasses.Prospecting}`}>{deal.stage}</span></td>
                      <td className="px-2 py-2 text-sm text-gray-900">{formatCurrency(deal.value)}</td>
                      <td className="px-2 py-2 text-sm text-gray-500">{formatDate(deal.close_date)}</td>
                    </tr>
                  ))}
                  {deals.length === 0 ? (
                    <tr className="h-10 border-b border-gray-100"><td colSpan="4" className="px-2 py-2 text-sm text-gray-500">No deals yet.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="py-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-gray-900">Notes</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                onBlur={handleNotesBlur}
                rows="7"
                className="w-full rounded border border-gray-200 p-2 text-sm text-gray-900 outline-none"
              />
            </label>
          </section>
        </>
      ) : (
        <div className="text-sm text-gray-500">School not found.</div>
      )}
    </aside>
  )
}
