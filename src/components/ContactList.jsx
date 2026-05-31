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
const dueTodayActivePill = 'rounded border border-rose-600 bg-rose-600 px-2.5 py-1 text-xs font-medium text-white transition-colors'
const emptyAddForm = { name: '', school_name: '', role: '', assigned_to: '' }

function isoDate(value) {
  return value ? String(value).slice(0, 10) : ''
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function followUpColorClasses(followUpAt, today) {
  if (!followUpAt) {
    return 'text-gray-400'
  }

  if (followUpAt < today) {
    return 'text-red-600'
  }

  if (followUpAt === today) {
    return 'text-amber-600'
  }

  return 'text-gray-500'
}

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
  const [selectedStatuses, setSelectedStatuses] = useState([])
  const [showDueToday, setShowDueToday] = useState(false)
  const [loading, setLoading] = useState(true)
  const [bulkStatus, setBulkStatus] = useState(statuses[0])
  const [bulkUpdating, setBulkUpdating] = useState(false)
  const [showAddRow, setShowAddRow] = useState(false)
  const [addForm, setAddForm] = useState(emptyAddForm)
  const [addError, setAddError] = useState('')
  const [addingContact, setAddingContact] = useState(false)

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

    const today = todayIsoDate()

    return contacts.filter((contact) => {
      const matchesSearch =
        !normalizedSearch ||
        contact.name?.toLowerCase().includes(normalizedSearch) ||
        contact.school_name?.toLowerCase().includes(normalizedSearch)
      const matchesRole = selectedRoles.length === 0 || selectedRoles.includes(contact.role)
      const matchesAssignee = selectedAssignees.length === 0 || selectedAssignees.includes(contact.assigned_to)
      const contactStatus = contact.status || 'New'
      const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(contactStatus)
      const followUpAt = isoDate(contact.follow_up_at)
      const matchesDueToday = !showDueToday || (followUpAt && followUpAt <= today)

      return matchesSearch && matchesRole && matchesAssignee && matchesStatus && matchesDueToday
    })
  }, [contacts, search, selectedRoles, selectedAssignees, selectedStatuses, showDueToday])

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

  function handleAddFormChange(field, value) {
    setAddForm((current) => ({ ...current, [field]: value }))
    setAddError('')
  }

  function handleCancelAdd() {
    setShowAddRow(false)
    setAddForm(emptyAddForm)
    setAddError('')
  }

  async function handleAddContact(event) {
    event.preventDefault()
    setAddError('')
    setAddingContact(true)

    try {
      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      })

      if (!response.ok) {
        throw new Error('Failed to add contact')
      }

      const createdContact = addSchool(await response.json())
      setContacts((current) => [createdContact, ...current])
      setAddForm(emptyAddForm)
      setShowAddRow(false)
    } catch (error) {
      setAddError('Failed to add.')
    } finally {
      setAddingContact(false)
    }
  }

  const today = todayIsoDate()

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
          <span className="mx-1 h-6 border-l border-gray-200" />
          {statuses.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setSelectedStatuses((current) => toggleValue(current, status))}
              className={selectedStatuses.includes(status) ? activePill : inactivePill}
            >
              {status}
            </button>
          ))}
          <span className="mx-1 h-6 border-l border-gray-200" />
          <button
            type="button"
            onClick={() => setShowDueToday((current) => !current)}
            className={showDueToday ? dueTodayActivePill : inactivePill}
          >
            Due today
          </button>
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
                <th className="px-3 py-2 font-medium">Follow Up</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {loading ? (
                <tr className="h-10 border-b border-gray-100">
                  <td colSpan="7" className="px-3 py-2 text-center text-sm text-gray-500">Loading contacts...</td>
                </tr>
              ) : filteredContacts.length === 0 ? (
                <tr className="h-10 border-b border-gray-100">
                  <td colSpan="7" className="px-3 py-2 text-center text-sm text-gray-500">No contacts found.</td>
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
                    <td className={`px-3 py-2 text-sm font-medium ${followUpColorClasses(isoDate(contact.follow_up_at), today)}`}>{isoDate(contact.follow_up_at) || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {showAddRow ? (
            <form onSubmit={handleAddContact} className="flex h-9 items-center gap-2 border-t border-gray-100 bg-white px-3 py-1 text-sm">
              <div className="w-7 shrink-0" />
              <input
                type="text"
                required
                value={addForm.name}
                onChange={(event) => handleAddFormChange('name', event.target.value)}
                placeholder="Name"
                className="h-7 min-w-0 flex-1 rounded border border-gray-200 px-2 text-sm text-gray-900 outline-none focus:border-gray-400"
              />
              <input
                type="text"
                value={addForm.school_name}
                onChange={(event) => handleAddFormChange('school_name', event.target.value)}
                placeholder="School"
                className="h-7 w-44 rounded border border-gray-200 px-2 text-sm text-gray-900 outline-none focus:border-gray-400"
              />
              <select
                value={addForm.role}
                onChange={(event) => handleAddFormChange('role', event.target.value)}
                className="h-7 w-24 rounded border border-gray-200 bg-white px-2 text-sm text-gray-900 outline-none focus:border-gray-400"
              >
                <option value="">Role</option>
                {roles.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
              <select
                value={addForm.assigned_to}
                onChange={(event) => handleAddFormChange('assigned_to', event.target.value)}
                className="h-7 w-32 rounded border border-gray-200 bg-white px-2 text-sm text-gray-900 outline-none focus:border-gray-400"
              >
                <option value="">Assigned To</option>
                {assignees.map((assignee) => (
                  <option key={assignee} value={assignee}>{assignee}</option>
                ))}
              </select>
              <button
                type="submit"
                disabled={addingContact}
                className="h-7 rounded bg-gray-900 px-3 text-xs font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {addingContact ? 'Adding...' : 'Add'}
              </button>
              <button type="button" onClick={handleCancelAdd} className="px-1 text-lg leading-none text-gray-400 hover:text-gray-700" aria-label="Cancel add contact">
                ×
              </button>
              {addError ? <span className="text-xs font-medium text-red-600">{addError}</span> : null}
            </form>
          ) : (
            <div className="border-t border-gray-100 bg-white">
              <button
                type="button"
                onClick={() => setShowAddRow(true)}
                className="px-3 py-2 text-left text-[13px] text-gray-400 transition-colors hover:text-gray-700"
              >
                + Add contact
              </button>
            </div>
          )}
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
