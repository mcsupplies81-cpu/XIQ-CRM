import { useEffect, useMemo, useState } from 'react'
import Avatar from './Avatar.jsx'
import ContactDetail from './ContactDetail.jsx'

const roles = ['HC', 'AD', 'OC']
const assignees = ['Email', 'Calls', 'DMs']
const statuses = ['New', 'Emailed', 'Called', 'Responded', 'Closed']
const statusSortOrder = statuses.reduce((order, status, index) => ({ ...order, [status]: index }), {})

const statusBadgeClasses = {
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
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [savingCells, setSavingCells] = useState({})
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


  const sortedContacts = useMemo(() => {
    if (!sortKey) {
      return filteredContacts
    }

    function sortValue(contact) {
      if (sortKey === 'school') {
        return contact.school_name
      }

      if (sortKey === 'status') {
        return contact.status || 'New'
      }

      if (sortKey === 'assigned_to') {
        return contact.assigned_to
      }

      if (sortKey === 'follow_up_at') {
        return isoDate(contact.follow_up_at) || null
      }

      return contact[sortKey]
    }

    return [...filteredContacts].sort((first, second) => {
      const firstValue = sortValue(first)
      const secondValue = sortValue(second)
      const firstIsNull = firstValue === null || firstValue === undefined || firstValue === ''
      const secondIsNull = secondValue === null || secondValue === undefined || secondValue === ''

      if (firstIsNull && secondIsNull) {
        return 0
      }

      if (firstIsNull) {
        return 1
      }

      if (secondIsNull) {
        return -1
      }

      let comparison

      if (sortKey === 'status') {
        comparison = (statusSortOrder[firstValue] ?? Number.MAX_SAFE_INTEGER) - (statusSortOrder[secondValue] ?? Number.MAX_SAFE_INTEGER)
      } else {
        comparison = String(firstValue).localeCompare(String(secondValue), undefined, { numeric: true, sensitivity: 'base' })
      }

      return sortDir === 'asc' ? comparison : -comparison
    })
  }, [filteredContacts, sortDir, sortKey])

  const allVisibleSelected = sortedContacts.length > 0 && sortedContacts.every((contact) => selectedIds.has(String(contact.id)))

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
        sortedContacts.forEach((contact) => next.delete(String(contact.id)))
      } else {
        sortedContacts.forEach((contact) => next.add(String(contact.id)))
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

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }

    setSortKey(key)
    setSortDir('asc')
  }

  async function handleInlineContactUpdate(contact, changes, fieldKey) {
    const cellKey = `${contact.id}:${fieldKey}`
    const previousContact = contact

    setSavingCells((current) => ({ ...current, [cellKey]: true }))
    setContacts((current) => current.map((item) => (item.id === contact.id ? { ...item, ...changes } : item)))
    setSelectedContact((current) => (current && current.id === contact.id ? { ...current, ...changes } : current))

    try {
      const response = await fetch(`/api/contacts/${contact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      })

      if (!response.ok) {
        throw new Error('Failed to update contact')
      }

      const updatedContact = addSchool(await response.json())
      setContacts((current) => current.map((item) => (item.id === contact.id ? { ...item, ...updatedContact } : item)))
      setSelectedContact((current) => (current && current.id === contact.id ? { ...current, ...updatedContact } : current))
    } catch (error) {
      setContacts((current) => current.map((item) => (item.id === contact.id ? previousContact : item)))
      setSelectedContact((current) => (current && current.id === contact.id ? previousContact : current))
    } finally {
      setSavingCells((current) => {
        const next = { ...current }
        delete next[cellKey]
        return next
      })
    }
  }

  function renderSortableHeader(label, key) {
    const active = sortKey === key

    return (
      <button
        type="button"
        onClick={() => handleSort(key)}
        className={`flex w-full items-center text-left font-semibold ${active ? 'text-gray-900' : 'text-gray-500'}`}
      >
        {label}
        <span className="ml-1 text-gray-400">{active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
      </button>
    )
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
    <div className="flex min-h-screen bg-white">
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

        <div className="border border-gray-200 overflow-hidden bg-white">
          <table className="min-w-full text-left">
            <thead className="sticky top-0 z-10 border-b border-gray-300 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr className="h-9">
                <th className="w-10 border-r border-gray-200 px-3 py-1.5 font-semibold">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={handleToggleAllVisible}
                    disabled={sortedContacts.length === 0}
                    aria-label="Select all visible contacts"
                    className="h-4 w-4 rounded border-gray-300 text-blue-600"
                  />
                </th>
                <th className="border-r border-gray-200 px-3 py-1.5 font-semibold">{renderSortableHeader('Name', 'name')}</th>
                <th className="border-r border-gray-200 px-3 py-1.5 font-semibold">{renderSortableHeader('School', 'school')}</th>
                <th className="border-r border-gray-200 px-3 py-1.5 font-semibold">{renderSortableHeader('Role', 'role')}</th>
                <th className="border-r border-gray-200 px-3 py-1.5 font-semibold">{renderSortableHeader('Status', 'status')}</th>
                <th className="border-r border-gray-200 px-3 py-1.5 font-semibold">{renderSortableHeader('Assigned To', 'assigned_to')}</th>
                <th className="px-3 py-1.5 font-semibold">{renderSortableHeader('Follow Up', 'follow_up_at')}</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {loading ? (
                <tr className="h-9 border-b border-gray-200">
                  <td colSpan="7" className="px-3 py-1.5 text-center text-[13px] text-gray-500">Loading contacts...</td>
                </tr>
              ) : sortedContacts.length === 0 ? (
                <tr className="h-9 border-b border-gray-200">
                  <td colSpan="7" className="px-3 py-1.5 text-center text-[13px] text-gray-500">No contacts found.</td>
                </tr>
              ) : (
                sortedContacts.map((contact) => {
                  const status = contact.status || 'New'
                  const statusSaving = savingCells[`${contact.id}:status`]
                  const assigneeSaving = savingCells[`${contact.id}:assigned_to`]

                  return (
                    <tr
                      key={contact.id}
                      onClick={() => setSelectedContact(contact)}
                      className={`h-9 cursor-pointer border-b border-gray-200 transition-colors hover:bg-gray-50/80 ${selectedContact?.id === contact.id ? 'bg-blue-50' : ''}`}
                    >
                      <td className="border-r border-gray-200 px-3 py-1.5" onClick={(event) => event.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(String(contact.id))}
                          onChange={() => handleToggleContact(contact.id)}
                          aria-label={`Select ${contact.name}`}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600"
                        />
                      </td>
                      <td className="border-r border-gray-200 px-3 py-1.5 text-[13px]">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={contact.name} />
                          <span className="truncate font-medium text-gray-900">{contact.name}</span>
                        </div>
                      </td>
                      <td className="border-r border-gray-200 px-3 py-1.5 text-[13px] text-gray-500">{contact.school_name || '—'}</td>
                      <td className="border-r border-gray-200 px-3 py-1.5"><span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">{contact.role || '—'}</span></td>
                      <td className="border-r border-gray-200 px-3 py-1.5">
                        <select
                          value={status}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => {
                            event.stopPropagation()
                            handleInlineContactUpdate(contact, { status: event.target.value }, 'status')
                          }}
                          disabled={statusSaving}
                          className={`appearance-none cursor-pointer rounded border-0 bg-transparent px-2 py-0.5 text-xs font-medium outline-none ${statusBadgeClasses[status] || statusBadgeClasses.New} ${statusSaving ? 'opacity-50 ring-1 ring-blue-200' : ''}`}
                        >
                          {statuses.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="border-r border-gray-200 px-3 py-1.5">
                        <select
                          value={contact.assigned_to || ''}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => {
                            event.stopPropagation()
                            handleInlineContactUpdate(contact, { assigned_to: event.target.value || null }, 'assigned_to')
                          }}
                          disabled={assigneeSaving}
                          className={`appearance-none cursor-pointer border-0 bg-transparent text-[13px] text-gray-500 outline-none ${assigneeSaving ? 'opacity-50 ring-1 ring-blue-200' : ''}`}
                        >
                          <option value="">Unassigned</option>
                          {assignees.map((assignee) => (
                            <option key={assignee} value={assignee}>
                              {assignee}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className={`px-3 py-1.5 text-[13px] font-medium ${followUpColorClasses(isoDate(contact.follow_up_at), today)}`}>{isoDate(contact.follow_up_at) || '—'}</td>
                    </tr>
                  )
                })
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
