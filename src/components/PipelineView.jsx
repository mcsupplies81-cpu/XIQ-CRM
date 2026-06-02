import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import StatusDot from './StatusDot.jsx'

const statuses = ['New', 'Emailed', 'Called', 'Responded', 'Closed']

function groupContacts(contacts) {
  return statuses.reduce((groups, status) => {
    groups[status] = contacts.filter((c) => (c.status || 'New') === status)
    return groups
  }, {})
}

function ContactCardBody({ contact }) {
  const isApptSet = contact.last_activity_notes?.toLowerCase().includes('appointment set')
  return (
    <>
      <div className="flex items-start justify-between gap-1">
        <div className="text-sm font-medium leading-snug text-gray-900">{contact.name}</div>
        {isApptSet ? (
          <span className="shrink-0 rounded bg-green-100 px-1.5 py-0.5 text-xs font-semibold text-green-700">
            Appt ✓
          </span>
        ) : null}
      </div>
      <div className="mt-1 text-xs text-gray-500">{contact.school_name || '—'}</div>
    </>
  )
}

function PipelineCard({ contact }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: String(contact.id),
  })

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`mb-2 cursor-grab touch-none select-none rounded border border-gray-200 bg-white p-3 transition-opacity ${
        isDragging ? 'opacity-20' : 'hover:border-gray-300'
      }`}
    >
      <ContactCardBody contact={contact} />
    </div>
  )
}

function DragOverlayCard({ contact }) {
  return (
    <div className="w-56 cursor-grabbing rounded border border-blue-300 bg-white p-3 shadow-xl ring-1 ring-blue-200">
      <ContactCardBody contact={contact} />
    </div>
  )
}

function PipelineColumn({ status, contacts }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <section
      className={`flex min-h-[500px] w-56 shrink-0 flex-col rounded-md border transition-colors ${
        isOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="shrink-0 px-3 pt-3 pb-0">
        <div className="mb-3 flex items-center justify-between gap-3">
          <StatusDot status={status} />
          <span className="text-xs text-gray-500">{contacts.length}</span>
        </div>
      </div>
      <div ref={setNodeRef} className="min-h-[400px] flex-1 px-3 pb-3">
        {contacts.map((contact) => (
          <PipelineCard key={contact.id} contact={contact} />
        ))}
      </div>
    </section>
  )
}

export default function PipelineView() {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeContact, setActiveContact] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )

  const fetchContacts = useCallback(async () => {
    const response = await fetch('/api/contacts')
    if (response.ok) {
      const data = await response.json()
      setContacts(data)
    }
  }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    fetchContacts()
      .then(() => { if (active) setLoading(false) })
      .catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [fetchContacts])

  useEffect(() => {
    const interval = setInterval(fetchContacts, 60_000)
    function onVisible() {
      if (document.visibilityState === 'visible') fetchContacts()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [fetchContacts])

  const groupedContacts = useMemo(() => groupContacts(contacts), [contacts])

  function handleDragStart(event) {
    const found = contacts.find((c) => String(c.id) === String(event.active.id))
    setActiveContact(found || null)
  }

  function handleDragCancel() {
    setActiveContact(null)
  }

  async function handleDragEnd(event) {
    const { active, over } = event
    setActiveContact(null)

    if (!over) return

    const contactId = String(active.id)
    const targetStatus = String(over.id)

    if (!statuses.includes(targetStatus)) return

    const activeContactObj = contacts.find((c) => String(c.id) === contactId)
    if (!activeContactObj || activeContactObj.status === targetStatus) return

    // Optimistic update
    const previousContacts = contacts
    setContacts((current) =>
      current.map((c) => (String(c.id) === contactId ? { ...c, status: targetStatus } : c)),
    )

    const response = await fetch(`/api/contacts/${contactId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: targetStatus }),
    })

    if (!response.ok) {
      setContacts(previousContacts)
    }
  }

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-gray-900">Contact Board</h1>
        <p className="mt-1 text-sm text-gray-500">
          Contacts organized by outreach status. Drag to move between stages.
        </p>
      </div>

      {loading ? (
        <div className="rounded-md border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
          Loading pipeline...
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={rectIntersection}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="flex gap-3 overflow-x-auto pb-4">
            {statuses.map((status) => (
              <PipelineColumn key={status} status={status} contacts={groupedContacts[status]} />
            ))}
          </div>
          <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }}>
            {activeContact ? <DragOverlayCard contact={activeContact} /> : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  )
}
