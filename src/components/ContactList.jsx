import { useEffect, useMemo, useState } from 'react'
import ContactDetail from './ContactDetail.jsx'

const roles = ['HC', 'AD', 'OC']
const assignees = ['Email', 'Calls', 'DMs']

export const statusBadgeClasses = {
  New: 'bg-gray-100 text-gray-700',
  Emailed: 'bg-blue-100 text-blue-700',
  Called: 'bg-amber-100 text-amber-700',
  Responded: 'bg-purple-100 text-purple-700',
  Closed: 'bg-green-100 text-green-700',
}

const activePill = 'border-gray-900 bg-gray-900 text-white rounded-full px-4 py-2 text-sm border'
const inactivePill = 'border-gray-300 bg-white text-gray-700 rounded-full border px-4 py-2 text-sm'

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
  const [search, setSearch] = useState('')
  const [selectedRoles, setSelectedRoles] = useState([])
  const [selectedAssignees, setSelectedAssignees] = useState([])
  const [loading, setLoading] = useState(true)

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

  function handleContactUpdated(updatedContact) {
    const normalizedContact = addSchool({ ...selectedContact, ...updatedContact })
    setContacts((current) => current.map((contact) => (contact.id === normalizedContact.id ? { ...contact, ...normalizedContact } : contact)))
    setSelectedContact(normalizedContact)
  }

  return (
    <div className="flex min-h-screen flex-col bg-white lg:flex-row">
      <section className="min-w-0 flex-1 p-6">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Contacts</h1>
            <p className="mt-1 text-sm text-gray-600">Search, filter, and manage your outreach list.</p>
          </div>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search contacts or schools"
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900 outline-none lg:max-w-sm"
          />
        </div>

        <div className="mb-6 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
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
          </div>
          <div className="flex flex-wrap gap-2">
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
        </div>

        <div className="overflow-x-auto border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">School</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Assigned To</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-4 py-8 text-center text-gray-600">Loading contacts...</td>
                </tr>
              ) : filteredContacts.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-4 py-8 text-center text-gray-600">No contacts found.</td>
                </tr>
              ) : (
                filteredContacts.map((contact) => (
                  <tr key={contact.id} onClick={() => setSelectedContact(contact)} className="cursor-pointer bg-white">
                    <td className="whitespace-nowrap px-4 py-4 font-medium text-gray-900">{contact.name}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-gray-700">{contact.school_name}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-gray-700">{contact.role}</td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusBadgeClasses[contact.status] || statusBadgeClasses.New}`}>
                        {contact.status || 'New'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-gray-700">{contact.assigned_to || 'Unassigned'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedContact ? (
        <ContactDetail
          contact={selectedContact}
          onClose={() => setSelectedContact(null)}
          onContactUpdated={handleContactUpdated}
        />
      ) : null}
    </div>
  )
}
