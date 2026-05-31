import { useEffect, useMemo, useState } from 'react'
import { DndContext, useDroppable } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { statusBadgeClasses } from './ContactList.jsx'

const statuses = ['New', 'Emailed', 'Called', 'Responded', 'Closed']

function groupContacts(contacts) {
  return statuses.reduce((groups, status) => {
    groups[status] = contacts.filter((contact) => (contact.status || 'New') === status)
    return groups
  }, {})
}

function PipelineCard({ contact }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: String(contact.id) })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="mb-2 cursor-grab rounded border border-gray-200 bg-white p-3 transition-colors hover:border-gray-300">
      <div className="text-sm font-medium text-gray-900">{contact.name}</div>
      <div className="mt-1 text-xs text-gray-500">{contact.school_name || '—'}</div>
    </div>
  )
}

function PipelineColumn({ status, contacts }) {
  const { setNodeRef } = useDroppable({ id: status })

  return (
    <section ref={setNodeRef} className="min-h-[500px] w-56 shrink-0 rounded-md border border-gray-200 bg-white p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusBadgeClasses[status]}`}>{status}</span>
        <span className="text-xs text-gray-500">{contacts.length}</span>
      </div>
      <SortableContext items={contacts.map((contact) => String(contact.id))} strategy={verticalListSortingStrategy}>
        <div>
          {contacts.map((contact) => (
            <PipelineCard key={contact.id} contact={contact} />
          ))}
        </div>
      </SortableContext>
    </section>
  )
}

export default function PipelineView() {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function loadContacts() {
      setLoading(true)
      const response = await fetch('/api/contacts')
      const data = response.ok ? await response.json() : []

      if (active) {
        setContacts(data)
        setLoading(false)
      }
    }

    loadContacts()

    return () => {
      active = false
    }
  }, [])

  const groupedContacts = useMemo(() => groupContacts(contacts), [contacts])

  function findContactStatus(contactId, groups) {
    return statuses.find((status) => groups[status].some((contact) => String(contact.id) === String(contactId)))
  }

  async function handleDragEnd(event) {
    const { active, over } = event

    if (!over) {
      return
    }

    const contactId = String(active.id)
    const targetColumn = statuses.includes(String(over.id)) ? String(over.id) : findContactStatus(over.id, groupedContacts)
    const activeContact = contacts.find((contact) => String(contact.id) === contactId)

    if (!targetColumn || !activeContact || activeContact.status === targetColumn) {
      return
    }

    const previousContacts = contacts
    setContacts((current) => current.map((contact) => (String(contact.id) === contactId ? { ...contact, status: targetColumn } : contact)))

    const response = await fetch(`/api/contacts/${contactId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: targetColumn }),
    })

    if (!response.ok) {
      setContacts(previousContacts)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-gray-900">Pipeline</h1>
      </div>

      {loading ? (
        <div className="rounded-md border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">Loading pipeline...</div>
      ) : (
        <DndContext onDragEnd={handleDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-4">
            {statuses.map((status) => (
              <PipelineColumn key={status} status={status} contacts={groupedContacts[status]} />
            ))}
          </div>
        </DndContext>
      )}
    </div>
  )
}
