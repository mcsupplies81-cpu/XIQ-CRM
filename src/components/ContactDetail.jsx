import { useEffect, useState } from 'react'

const statuses = ['New', 'Emailed', 'Called', 'Responded', 'Closed']
const assignees = ['Email', 'Calls', 'DMs']
const activityIcons = {
  call: '☎',
  email: '✉',
  dm: '@',
}

function cleanHandle(handle) {
  return handle ? handle.replace(/^@/, '') : ''
}

export default function ContactDetail({ contact, onClose, onContactUpdated }) {
  const [notes, setNotes] = useState(contact.notes || '')
  const [originalNotes, setOriginalNotes] = useState(contact.notes || '')
  const [status, setStatus] = useState(contact.status || 'New')
  const [assignedTo, setAssignedTo] = useState(contact.assigned_to || '')
  const [activities, setActivities] = useState([])
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let active = true

    setNotes(contact.notes || '')
    setOriginalNotes(contact.notes || '')
    setStatus(contact.status || 'New')
    setAssignedTo(contact.assigned_to || '')
    setActivities([])

    async function loadActivities() {
      const response = await fetch(`/api/activities?contact_id=${encodeURIComponent(contact.id)}`)
      const data = response.ok ? await response.json() : []

      if (active) {
        setActivities(data)
      }
    }

    loadActivities()

    return () => {
      active = false
    }
  }, [contact.id])

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
    } catch {
      setNotes(previousNotes)
    }
  }

  const xHandle = cleanHandle(contact.x_handle)

  return (
    <aside className="w-full border-t border-gray-200 bg-white p-6 lg:w-[420px] lg:border-l lg:border-t-0">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{contact.name}</h2>
          <p className="mt-1 text-sm text-gray-600">{contact.schools?.name}</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700">
          Close
        </button>
      </div>

      <div className="space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500">Role</div>
            <div className="mt-1 text-gray-900">{contact.role || '—'}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500">Location</div>
            <div className="mt-1 text-gray-900">{[contact.city, contact.state].filter(Boolean).join(', ') || '—'}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500">Email</div>
            <div className="mt-1 break-words text-gray-900">{contact.email || '—'}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500">Phone</div>
            <div className="mt-1 text-gray-900">{contact.phone || '—'}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500">X Handle</div>
            <div className="mt-1 text-gray-900">{contact.x_handle || '—'}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-gray-500">Status</span>
            <select value={status} onChange={handleStatusChange} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900">
              {statuses.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs uppercase tracking-wide text-gray-500">Assigned To</span>
            <select value={assignedTo} onChange={handleAssignedToChange} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900">
              <option value="">Unassigned</option>
              {assignees.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {contact.phone ? (
            <a href={`tel:${contact.phone}`} className="rounded-lg border border-gray-300 px-4 py-3 text-center font-medium text-gray-900">Call</a>
          ) : (
            <span className="rounded-lg border border-gray-200 px-4 py-3 text-center font-medium text-gray-400">Call</span>
          )}
          <a href="https://app.instantly.ai" target="_blank" rel="noreferrer" className="rounded-lg border border-gray-300 px-4 py-3 text-center font-medium text-gray-900">Email</a>
          {xHandle ? (
            <a href={`https://x.com/${xHandle}`} target="_blank" rel="noreferrer" className="rounded-lg border border-gray-300 px-4 py-3 text-center font-medium text-gray-900">DM</a>
          ) : (
            <span className="rounded-lg border border-gray-200 px-4 py-3 text-center font-medium text-gray-400">DM</span>
          )}
        </div>

        <label className="block">
          <span className="text-xs uppercase tracking-wide text-gray-500">Notes</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            onBlur={handleNotesBlur}
            rows="6"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none"
          />
        </label>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Activity</h3>
            {isSaving ? <span className="text-xs text-gray-500">Saving...</span> : null}
          </div>
          <div className="space-y-3">
            {activities.length === 0 ? (
              <p className="text-gray-600">No activity yet.</p>
            ) : (
              activities.slice(0, 5).map((activity) => (
                <div key={activity.id} className="border border-gray-200 p-3">
                  <div className="mb-1 flex items-center gap-2 text-gray-900">
                    <span>{activityIcons[activity.type] || '•'}</span>
                    <span className="font-medium">{activity.type}</span>
                  </div>
                  <p className="text-gray-700">{activity.notes || 'No notes'}</p>
                  <p className="mt-2 text-xs text-gray-500">{new Date(activity.created_at).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </aside>
  )
}
