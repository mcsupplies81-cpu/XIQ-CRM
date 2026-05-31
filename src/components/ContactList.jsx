import { useEffect, useMemo, useState } from 'react'
import ContactDetail from './ContactDetail.jsx'

const roles = ['HC', 'AD', 'OC']
const assignees = ['Email', 'Calls', 'DMs']
const statuses = ['New', 'Emailed', 'Called', 'Responded', 'Closed']

export const statusBadgeClasses = {
  New: 'bg-gray-100 text-gray-700',
  Emailed: 'bg-blue-100 text-blue-700',
  Called: 'bg-amber-100 text-amber-700',
  Responded: 'bg-purple-100 text-purple-700',
  Closed: 'bg-green-100 text-green-700',
}

const activePill = 'rounded border border-gray-900 bg-gray-900 px-2.5 py-1 text-xs font-medium text-white transition-colors'
const inactivePill = 'rounded border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50'

function addSchool(contact) {
  return {
    ...contact,
    schools: {
      name: contact.school_name,
      city: contact.city,
      state: contact.state,
    },
  }
}

function toggleValue(values, value) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
}

export default function ContactList() {
  const [contacts, setContacts] = useState([])
  const [selectedContact, setSelectedContact] = useState(null)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [search, setSearch] = useState('')
  const [selectedRoles, setSelectedRoles] = useState([])
  const [selectedAssignees, setSelectedAssignees] = useState([])
  const [loading, setLoading] = useState(true)
  const [bulkStatus, setBulkStatus] = useState(statuses[0])
  const [bulkUpdating, setBulkUpdating] = useState(false)

  useEffect(() => {
    let active = true

    async function loadContacts() {
      setLoading(true)
      const response = await fetch('/api/contacts')
      const data = response.ok ? await response.json() : []

      if (active) {
        setContacts(data.map(addSchool))
        setLoading(false)
      }
    }

    loadContacts()

    return () => {
      active = false
    }
  }, [])

  const filteredContacts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return contacts.filter((contact) => {
      const matchesSearch =
        !normalizedSearch ||
        contact.name?.toLowerCase().includes(normalizedSearch) ||
        contact.school_name?.toLowerCase().includes(normalizedSearch)
      const matchesRole = selectedRoles.length === 0 || selectedRoles.includes(contact.role)
      const matchesAssignee = selectedAssignees.length === 0 || selectedAssignees.includes(contact.assigned_to)

      return matchesSearch && matchesRole && matchesAssignee
    })
  }, [contacts, search, selectedRoles, selectedAssignees])

  const allVisibleSelected = filteredContacts.length > 0 && filteredContacts.every((contact) => selectedIds.has(String(contact.id)))

  function handleContactUpdated(updatedContact) {
    const normalizedContact = addSchool({ ...selectedContact, ...updatedContact })
    setContacts((current) => current.map((contact) => (contact.id === normalizedContact.id ? { ...contact, ...normalizedContact } : contact)))
    setSelectedContact(normalizedContact)
    setSelectedIds((current) => {
      const next = new Set(current)
      next.delete(String(normalizedContact.id))
      return next
    })
  }

  function handleToggleAllVisible() {
    setSelectedIds((current) => {
      const next = new Set(current)

      if (allVisibleSelected) {
        filteredContacts.forEach((contact) => next.delete(String(contact.id)))
      } else {
        filteredContacts.forEach((contact) => next.add(String(contact.id)))
      }

      return next
    })
  }

  function handleToggleContact(contactId) {
    setSelectedIds((current) => {
      const next = new Set(current)
      const normalizedId = String(contactId)

      if (next.has(normalizedId)) {
        next.delete(normalizedId)
      } else {
        next.add(normalizedId)
      }

      return next
    })
  }

  async function handleBulkStatusUpdate(event) {
    event.preventDefault()

    if (selectedIds.size === 0) {
      return
    }

    const ids = Array.from(selectedIds)
    setBulkUpdating(true)

    try {
      const response = await fetch('/api/contacts/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, status: bulkStatus }),
      })

      if (!response.ok) {
        throw new Error('Failed to update contacts')
      }

      const updatedIds = new Set(ids)
      setContacts((current) => current.map((contact) => (updatedIds.has(String(contact.id)) ? { ...contact, status: bulkStatus } : contact)))
      setSelectedContact((current) => (current && updatedIds.has(String(current.id)) ? { ...current, status: bulkStatus } : current))
      setSelectedIds(new Set())
    } finally {
      setBulkUpdating(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <section className="min-w-0 flex-1 p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-gray-900">Contacts</h1>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search contacts or schools"
            className="w-80 rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none"
          />
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {roles.map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => setSelectedRoles((current) => toggleValue(current, role))}
              className={selectedRoles.includes(role) ? activePill : inactivePill}
            >
              {role}
            </button>
          ))}
          <span className="mx-1 h-6 border-l border-gray-200" />
          {assignees.map((assignee) => (
            <button
              key={assignee}
              type="button"
              onClick={() => setSelectedAssignees((current) => toggleValue(current, assignee))}
              className={selectedAssignees.includes(assignee) ? activePill : inactivePill}
            >
              {assignee}
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
          <table className="min-w-full text-left">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
              <tr className="h-9">
                <th className="w-10 px-3 py-2 font-medium">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={handleToggleAllVisible}
                    disabled={filteredContacts.length === 0}
                    aria-label="Select all visible contacts"
                    className="h-4 w-4 rounded border-gray-300 text-blue-600"
                  />
                </th>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">School</th>
                <th className="px-3 py-2 font-medium">Role</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Assigned To</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {loading ? (
                <tr className="h-10 border-b border-gray-100">
                  <td colSpan="6" className="px-3 py-2 text-center text-sm text-gray-500">Loading contacts...</td>
                </tr>
              ) : filteredContacts.length === 0 ? (
                <tr className="h-10 border-b border-gray-100">
                  <td colSpan="6" className="px-3 py-2 text-center text-sm text-gray-500">No contacts found.</td>
                </tr>
              ) : (
                filteredContacts.map((contact) => (
                  <tr
                    key={contact.id}
                    onClick={() => setSelectedContact(contact)}
                    className={`h-10 cursor-pointer border-b border-gray-100 transition-colors hover:bg-gray-50 ${selectedContact?.id === contact.id ? 'bg-blue-50' : ''}`}
                  >
                    <td className="px-3 py-2" onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(String(contact.id))}
                        onChange={() => handleToggleContact(contact.id)}
                        aria-label={`Select ${contact.name}`}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600"
                      />
                    </td>
                    <td className="px-3 py-2 text-sm font-medium text-gray-900">{contact.name}</td>
                    <td className="px-3 py-2 text-sm text-gray-500">{contact.school_name || '—'}</td>
                    <td className="px-3 py-2"><span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">{contact.role || '—'}</span></td>
                    <td className="px-3 py-2"><span className={`rounded px-2 py-0.5 text-xs font-medium ${statusBadgeClasses[contact.status || 'New'] || statusBadgeClasses.New}`}>{contact.status || 'New'}</span></td>
                    <td className="px-3 py-2 text-sm text-gray-500">{contact.assigned_to || 'Unassigned'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {selectedIds.size > 0 ? (
          <form
            onSubmit={handleBulkStatusUpdate}
            className="sticky bottom-0 mt-4 flex items-center justify-between gap-3 border-t border-gray-200 bg-white px-4 py-3 shadow-md"
          >
            <span className="text-sm font-medium text-gray-700">{selectedIds.size} contacts selected</span>
            <div className="flex items-center gap-2">
              <select
                value={bulkStatus}
                onChange={(event) => setBulkStatus(event.target.value)}
                className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none"
              >
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={bulkUpdating}
                className="rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {bulkUpdating ? 'Updating...' : 'Update Status'}
              </button>
            </div>
          </form>
        ) : null}
      </section>

      {selectedContact ? (
        <ContactDetail contact={selectedContact} onClose={() => setSelectedContact(null)} onContactUpdated={handleContactUpdated} />
      ) : null}
    </div>
  )
}
