import { useEffect, useState } from 'react'
import { statusBadgeClasses } from './ContactList.jsx'

const statuses = ['New', 'Emailed', 'Called', 'Responded', 'Closed']
const assignees = ['Email', 'Calls', 'DMs']
const activityIcons = {
  call: '☎',
  email: '✉',
  dm: '@',
}

const stageBadgeClasses = {
  Prospecting: 'bg-gray-100 text-gray-700',
  Proposal: 'bg-blue-100 text-blue-700',
  Negotiation: 'bg-amber-100 text-amber-700',
  'Closed Won': 'bg-emerald-100 text-emerald-700',
  'Closed Lost': 'bg-red-100 text-red-700',
}

function cleanHandle(handle) {
  return handle ? handle.replace(/^@/, '') : ''
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === '') {
    return '—'
  }

  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value))
}

function activityTypeForPayload(type) {
  return type.toLowerCase()
}

export default function ContactDetail({ contact, onClose, onContactUpdated }) {
  const [notes, setNotes] = useState(contact.notes || '')
  const [originalNotes, setOriginalNotes] = useState(contact.notes || '')
  const [status, setStatus] = useState(contact.status || 'New')
  const [assignedTo, setAssignedTo] = useState(contact.assigned_to || '')
  const [activities, setActivities] = useState([])
  const [deals, setDeals] = useState([])
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let active = true

    setNotes(contact.notes || '')
    setOriginalNotes(contact.notes || '')
    setStatus(contact.status || 'New')
    setAssignedTo(contact.assigned_to || '')
    setActivities([])
    setDeals([])

    async function loadContactPanels() {
      const [activitiesResponse, dealsResponse] = await Promise.all([
        fetch(`/api/activities?contact_id=${encodeURIComponent(contact.id)}`),
        fetch(`/api/deals?contact_id=${encodeURIComponent(contact.id)}`),
      ])
      const activitiesData = activitiesResponse.ok ? await activitiesResponse.json() : []
      const dealsData = dealsResponse.ok ? await dealsResponse.json() : []

      if (active) {
        setActivities(activitiesData)
        setDeals(dealsData)
      }
    }

    loadContactPanels()

    return () => {
      active = false
    }
  }, [contact.id])

  async function logActivity(type, activityNotes) {
    const response = await fetch('/api/activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_id: contact.id, type: activityTypeForPayload(type), notes: activityNotes }),
    })

    if (response.ok) {
      const activity = await response.json()
      setActivities((current) => [activity, ...current].slice(0, 5))
    }
  }

  async function patchContact(payload) {
    setIsSaving(true)
    const response = await fetch(`/api/contacts/${contact.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      setIsSaving(false)
      throw new Error('Unable to update contact')
    }

    const updatedContact = await response.json()
    onContactUpdated({ ...contact, ...updatedContact, ...payload })
    setIsSaving(false)
    return updatedContact
  }

  async function handleStatusChange(event) {
    const nextStatus = event.target.value
    const previousStatus = status
    setStatus(nextStatus)

    try {
      await patchContact({ status: nextStatus })
    } catch {
      setStatus(previousStatus)
    }
  }

  async function handleAssignedToChange(event) {
    const nextAssignedTo = event.target.value
    const previousAssignedTo = assignedTo
    setAssignedTo(nextAssignedTo)

    try {
      await patchContact({ assigned_to: nextAssignedTo })
    } catch {
      setAssignedTo(previousAssignedTo)
    }
  }

  async function handleNotesBlur() {
    if (notes === originalNotes) {
      return
    }

    const previousNotes = originalNotes

    try {
      await patchContact({ notes })
      setOriginalNotes(notes)
      await logActivity('notes', 'Updated contact notes')
    } catch {
      setNotes(previousNotes)
    }
  }

  const xHandle = cleanHandle(contact.x_handle)
  const location = [contact.city, contact.state].filter(Boolean).join(', ') || '—'

  return (
    <aside className="w-[420px] flex-shrink-0 border-l border-gray-200 bg-white p-5 min-h-screen">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold text-gray-900">{contact.name}</h2>
          <p className="mt-1 text-sm text-gray-500">{contact.schools?.name || contact.school_name || '—'}</p>
        </div>
        <button type="button" onClick={onClose} className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50">
          Close
        </button>
      </div>

      <section className="border-b border-gray-100 py-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Role</div>
            <div className="mt-1 text-gray-900">{contact.role || '—'}</div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Email</div>
            <div className="mt-1 break-words text-gray-900">{contact.email || '—'}</div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Phone</div>
            <div className="mt-1 text-gray-900">{contact.phone || '—'}</div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500">X Handle</div>
            <div className="mt-1 text-gray-900">{contact.x_handle || '—'}</div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Location</div>
            <div className="mt-1 text-gray-900">{location}</div>
          </div>
        </div>
      </section>

      <section className="border-b border-gray-100 py-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Status</span>
            <select value={status} onChange={handleStatusChange} className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none">
              {statuses.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Assigned To</span>
            <select value={assignedTo} onChange={handleAssignedToChange} className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none">
              <option value="">Unassigned</option>
              {assignees.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="border-b border-gray-100 py-4">
        <div className="flex gap-2">
          {contact.phone ? (
            <a href={`tel:${contact.phone}`} onClick={() => logActivity('call', 'Started a call')} className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50">Call</a>
          ) : (
            <span className="rounded border border-gray-200 px-3 py-1.5 text-sm text-gray-400">Call</span>
          )}
          <a href="https://app.instantly.ai" target="_blank" rel="noreferrer" onClick={() => logActivity('email', 'Opened Instantly email')} className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50">Email</a>
          {xHandle ? (
            <a href={`https://x.com/${xHandle}`} target="_blank" rel="noreferrer" onClick={() => logActivity('dm', 'Opened X DM')} className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50">DM</a>
          ) : (
            <span className="rounded border border-gray-200 px-3 py-1.5 text-sm text-gray-400">DM</span>
          )}
        </div>
      </section>

      <section className="border-b border-gray-100 py-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Notes</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            onBlur={handleNotesBlur}
            rows="5"
            className="w-full rounded border border-gray-200 p-2 text-sm text-gray-900 outline-none"
          />
        </label>
      </section>

      <section className="border-b border-gray-100 py-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Deals</h3>
        <div className="space-y-2">
          {deals.length === 0 ? (
            <p className="text-sm text-gray-500">No deals yet.</p>
          ) : (
            deals.map((deal) => (
              <div key={deal.id} className="rounded border border-gray-200 p-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium text-gray-900">{deal.title}</div>
                  <div className="text-sm text-gray-900">{formatCurrency(deal.value)}</div>
                </div>
                <span className={`mt-2 inline-block rounded px-2 py-0.5 text-xs font-medium ${stageBadgeClasses[deal.stage] || stageBadgeClasses.Prospecting}`}>{deal.stage}</span>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="py-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Activity</h3>
          {isSaving ? <span className="text-xs text-gray-500">Saving...</span> : null}
        </div>
        <div className="space-y-2">
          {activities.length === 0 ? (
            <p className="text-sm text-gray-500">No activity yet.</p>
          ) : (
            activities.slice(0, 5).map((activity) => (
              <div key={activity.id} className="rounded border border-gray-200 p-2">
                <div className="flex items-center gap-2 text-sm text-gray-900">
                  <span>{activityIcons[activity.type] || '•'}</span>
                  <span>{activity.notes || activity.type}</span>
                </div>
                <p className="mt-1 text-xs text-gray-500">{new Date(activity.created_at).toLocaleString()}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </aside>
  )
}
