import { useEffect, useRef, useState } from 'react'

const statuses = ['New', 'Emailed', 'Called', 'Responded', 'Closed']
const assignees = ['Email', 'Calls', 'DMs']
const activityTypeClasses = {
  call: 'bg-amber-100 text-amber-700',
  email: 'bg-blue-100 text-blue-700',
  dm: 'bg-purple-100 text-purple-700',
}

const templateTypeBadgeClasses = {
  email: 'bg-blue-100 text-blue-700',
  dm: 'bg-purple-100 text-purple-700',
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

function formatRelativeTime(value) {
  const timestamp = new Date(value).getTime()

  if (Number.isNaN(timestamp)) {
    return 'just now'
  }

  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000))
  const intervals = [
    { label: 'y', seconds: 31536000 },
    { label: 'mo', seconds: 2592000 },
    { label: 'w', seconds: 604800 },
    { label: 'd', seconds: 86400 },
    { label: 'h', seconds: 3600 },
    { label: 'm', seconds: 60 },
  ]

  for (const interval of intervals) {
    const count = Math.floor(seconds / interval.seconds)
    if (count >= 1) {
      return `${count}${interval.label} ago`
    }
  }

  return 'just now'
}

function dateInputValue(value) {
  return value ? String(value).slice(0, 10) : ''
}

function applyTemplateVariables(body, contact) {
  return body
    .replaceAll('{contact_name}', contact.name || '')
    .replaceAll('{school_name}', contact.school_name || contact.schools?.name || '')
    .replaceAll('{role}', contact.role || '')
}

export default function ContactDetail({ contact, onClose, onContactUpdated }) {
  const [notes, setNotes] = useState(contact.notes || '')
  const [originalNotes, setOriginalNotes] = useState(contact.notes || '')
  const [status, setStatus] = useState(contact.status || 'New')
  const [assignedTo, setAssignedTo] = useState(contact.assigned_to || '')
  const [followUpAt, setFollowUpAt] = useState(dateInputValue(contact.follow_up_at))
  const [showFollowUpSaved, setShowFollowUpSaved] = useState(false)
  const followUpSavedTimeout = useRef(null)
  const [activities, setActivities] = useState([])
  const [activityType, setActivityType] = useState('call')
  const [activityNotes, setActivityNotes] = useState('')
  const [deals, setDeals] = useState([])
  const [isSaving, setIsSaving] = useState(false)
  const [isLoggingActivity, setIsLoggingActivity] = useState(false)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [templates, setTemplates] = useState([])
  const [templatesLoading, setTemplatesLoading] = useState(false)

  useEffect(() => {
    let active = true

    setNotes(contact.notes || '')
    setOriginalNotes(contact.notes || '')
    setStatus(contact.status || 'New')
    setAssignedTo(contact.assigned_to || '')
    setFollowUpAt(dateInputValue(contact.follow_up_at))
    setShowFollowUpSaved(false)
    if (followUpSavedTimeout.current) {
      clearTimeout(followUpSavedTimeout.current)
    }
    setActivities([])
    setActivityType('call')
    setActivityNotes('')
    setDeals([])
    setShowTemplateModal(false)

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
      if (followUpSavedTimeout.current) {
        clearTimeout(followUpSavedTimeout.current)
      }
    }
  }, [contact.id])

  async function logActivity(type, activityNotes) {
    const response = await fetch('/api/activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_id: contact.id, type: activityTypeForPayload(type), notes: activityNotes }),
    })

    if (!response.ok) {
      return null
    }

    const activity = await response.json()
    setActivities((current) => [activity, ...current])
    return activity
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

  async function handleActivitySubmit(event) {
    event.preventDefault()

    const trimmedNotes = activityNotes.trim()

    if (!trimmedNotes) {
      return
    }

    setIsLoggingActivity(true)

    try {
      const activity = await logActivity(activityType, trimmedNotes)
      if (activity) {
        setActivityNotes('')
      }
    } finally {
      setIsLoggingActivity(false)
    }
  }

  async function handleFollowUpChange(event) {
    const nextFollowUpAt = event.target.value
    const previousFollowUpAt = followUpAt
    setFollowUpAt(nextFollowUpAt)
    setShowFollowUpSaved(false)
    if (followUpSavedTimeout.current) {
      clearTimeout(followUpSavedTimeout.current)
    }

    try {
      await patchContact({ follow_up_at: nextFollowUpAt || null })
      setShowFollowUpSaved(true)
      followUpSavedTimeout.current = setTimeout(() => {
        setShowFollowUpSaved(false)
        followUpSavedTimeout.current = null
      }, 2000)
    } catch {
      setFollowUpAt(previousFollowUpAt)
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

  async function openTemplateModal() {
    setShowTemplateModal(true)
    setTemplatesLoading(true)

    const response = await fetch('/api/templates')
    const data = response.ok ? await response.json() : []

    setTemplates(data)
    setTemplatesLoading(false)
  }

  function handleTemplateSelect(template) {
    setNotes(applyTemplateVariables(template.body, contact))
    setShowTemplateModal(false)
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
          <span className="mb-1 flex items-center justify-between gap-3">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Notes</span>
            <button type="button" onClick={openTemplateModal} className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 transition-colors hover:bg-gray-50">
              Use Template
            </button>
          </span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            onBlur={handleNotesBlur}
            rows="5"
            className="w-full rounded border border-gray-200 p-2 text-sm text-gray-900 outline-none"
          />
        </label>
        <label className="mt-3 block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Follow up on</span>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={followUpAt}
              onChange={handleFollowUpChange}
              className="rounded border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none"
            />
            <span className={`text-xs text-emerald-600 transition-opacity duration-300 ${showFollowUpSaved ? 'opacity-100' : 'opacity-0'}`}>Saved</span>
          </div>
        </label>
      </section>

      <section className="border-b border-gray-100 py-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Activity</h3>
          {isSaving ? <span className="text-xs text-gray-500">Saving...</span> : null}
        </div>

        {activities.length === 0 ? (
          <p className="text-sm italic text-gray-500">No activity logged yet.</p>
        ) : (
          <div className="ml-2 space-y-4 border-l border-gray-200 pl-4">
            {activities.map((activity) => (
              <div key={activity.id} className="relative text-sm">
                <span className="absolute -left-[23px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-gray-400 ring-1 ring-gray-200" />
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded px-2 py-0.5 text-xs font-medium uppercase ${activityTypeClasses[activity.type] || 'bg-gray-100 text-gray-700'}`}>
                    {activity.type}
                  </span>
                  <span className="text-xs text-gray-500">{formatRelativeTime(activity.created_at)}</span>
                </div>
                <p className="mt-1 text-gray-900">{activity.notes || '—'}</p>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleActivitySubmit} className="mt-4 flex gap-2">
          <select
            value={activityType}
            onChange={(event) => setActivityType(event.target.value)}
            className="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 outline-none"
          >
            <option value="call">Call</option>
            <option value="email">Email</option>
            <option value="dm">DM</option>
          </select>
          <input
            type="text"
            value={activityNotes}
            onChange={(event) => setActivityNotes(event.target.value)}
            placeholder="Add notes..."
            className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-900 outline-none"
          />
          <button
            type="submit"
            disabled={isLoggingActivity || !activityNotes.trim()}
            className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoggingActivity ? 'Logging...' : 'Log'}
          </button>
        </form>
      </section>

      <section className="py-4">
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

      {showTemplateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-900">Use Template</h3>
              <button type="button" onClick={() => setShowTemplateModal(false)} className="rounded px-2 py-1 text-xl leading-none text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900" aria-label="Close template picker">
                ×
              </button>
            </div>
            <div className="max-h-[60vh] space-y-2 overflow-y-auto p-4">
              {templatesLoading ? <p className="text-sm text-gray-500">Loading templates...</p> : null}
              {!templatesLoading && templates.length === 0 ? <p className="text-sm text-gray-500">No templates yet.</p> : null}
              {templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => handleTemplateSelect(template)}
                  className="block w-full rounded border border-gray-200 p-3 text-left transition-colors hover:border-gray-300 hover:bg-gray-50"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-gray-900">{template.name}</span>
                    <span className={`rounded px-2 py-0.5 text-xs font-medium uppercase ${templateTypeBadgeClasses[template.type] || templateTypeBadgeClasses.email}`}>{template.type}</span>
                  </div>
                  <p className="line-clamp-2 whitespace-pre-wrap text-xs text-gray-500">{template.body}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  )
}
