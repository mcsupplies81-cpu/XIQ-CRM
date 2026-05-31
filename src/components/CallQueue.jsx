import { useEffect, useMemo, useState } from 'react'
import Avatar from './Avatar.jsx'
import StatusDot from './StatusDot.jsx'

const statusOrder = {
  New: 0,
  Called: 1,
  Responded: 2,
}

const outcomeButtonClasses = {
  'No Answer': 'bg-gray-600 hover:bg-gray-700',
  'Not Interested': 'bg-red-600 hover:bg-red-700',
  'Left Voicemail': 'bg-amber-500 hover:bg-amber-600',
  'Appointment Set ✓': 'bg-green-600 hover:bg-green-700',
}

const outcomes = [
  { label: 'No Answer', status: null, notes: 'No answer' },
  { label: 'Not Interested', status: 'Closed', notes: 'Not interested' },
  { label: 'Left Voicemail', status: 'Called', notes: 'Left voicemail' },
  { label: 'Appointment Set ✓', status: 'Responded', notes: 'Appointment set' },
]

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

function sortQueue(contacts) {
  return [...contacts].sort((first, second) => {
    const firstStatus = first.status || 'New'
    const secondStatus = second.status || 'New'
    const statusDifference = (statusOrder[firstStatus] ?? 3) - (statusOrder[secondStatus] ?? 3)

    if (statusDifference !== 0) {
      return statusDifference
    }

    const firstFollowUp = isoDate(first.follow_up_at)
    const secondFollowUp = isoDate(second.follow_up_at)

    if (!firstFollowUp && !secondFollowUp) {
      return 0
    }

    if (!firstFollowUp) {
      return 1
    }

    if (!secondFollowUp) {
      return -1
    }

    return firstFollowUp.localeCompare(secondFollowUp)
  })
}

function relativeTime(value) {
  const createdAt = new Date(value)
  const diffMs = Date.now() - createdAt.getTime()

  if (Number.isNaN(createdAt.getTime())) {
    return ''
  }

  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000))

  if (diffMinutes < 1) {
    return 'just now'
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`
  }

  const diffHours = Math.floor(diffMinutes / 60)

  if (diffHours < 24) {
    return `${diffHours}h ago`
  }

  const diffDays = Math.floor(diffHours / 24)

  if (diffDays < 30) {
    return `${diffDays}d ago`
  }

  const diffMonths = Math.floor(diffDays / 30)
  return `${diffMonths}mo ago`
}

function progressBarColor(callCount) {
  if (callCount >= 20) {
    return 'bg-green-500'
  }

  if (callCount >= 10) {
    return 'bg-amber-500'
  }

  return 'bg-gray-400'
}

function locationText(contact) {
  return [contact.city, contact.state].filter(Boolean).join(', ') || '—'
}

export default function CallQueue() {
  const [queue, setQueue] = useState([])
  const [selectedContact, setSelectedContact] = useState(null)
  const [activitiesByContact, setActivitiesByContact] = useState({})
  const [callsToday, setCallsToday] = useState(0)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [pendingFollowUp, setPendingFollowUp] = useState(null)

  useEffect(() => {
    let active = true

    async function loadQueue() {
      setLoading(true)
      setError('')

      try {
        const [contactsResponse, todayResponse] = await Promise.all([
          fetch('/api/contacts'),
          fetch('/api/activities/today'),
        ])
        const data = contactsResponse.ok ? await contactsResponse.json() : []
        const todayData = todayResponse.ok ? await todayResponse.json() : {}
        const callQueue = sortQueue(data.filter((contact) => contact.assigned_to === 'Calls' && (contact.status || 'New') !== 'Closed'))

        if (!active) {
          return
        }

        setQueue(callQueue)
        setSelectedContact(callQueue[0] || null)
        setCallsToday(Number(todayData.call_count) || 0)
      } catch (loadError) {
        if (active) {
          setError('Unable to load the call queue.')
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadQueue()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!selectedContact) {
      return
    }

    const contactId = String(selectedContact.id)

    if (activitiesByContact[contactId]) {
      return
    }

    let active = true

    async function loadActivities() {
      const response = await fetch(`/api/activities?contact_id=${encodeURIComponent(selectedContact.id)}`)
      const activities = response.ok ? await response.json() : []

      if (active) {
        setActivitiesByContact((current) => ({ ...current, [contactId]: activities }))
      }
    }

    loadActivities()

    return () => {
      active = false
    }
  }, [activitiesByContact, selectedContact])

  const today = todayIsoDate()
  const progressPercent = Math.min(100, (callsToday / 20) * 100)
  const selectedActivities = selectedContact ? activitiesByContact[String(selectedContact.id)] || [] : []
  const recentCalls = selectedActivities.filter((activity) => activity.type === 'call').slice(0, 5)

  function advanceQueue(contactId) {
    setQueue((current) => {
      const contactIndex = current.findIndex((contact) => String(contact.id) === String(contactId))
      const nextQueue = current.filter((contact) => String(contact.id) !== String(contactId))
      const nextContact = nextQueue[contactIndex] || nextQueue[contactIndex - 1] || nextQueue[0] || null
      setSelectedContact(nextContact)
      return nextQueue
    })
  }

  async function postCallActivity(contactId, activityNotes) {
    const response = await fetch('/api/activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_id: contactId, type: 'call', notes: activityNotes }),
    })

    if (!response.ok) {
      throw new Error('Failed to log call activity')
    }

    const activity = await response.json()
    setActivitiesByContact((current) => {
      const contactActivities = current[String(contactId)] || []
      return { ...current, [String(contactId)]: [activity, ...contactActivities] }
    })

    return activity
  }

  async function handleOutcome(outcome) {
    if (!selectedContact || actionLoading) return

    setActionLoading(true)
    setError('')

    try {
      const nextStatus = outcome.status || selectedContact.status || 'New'
      const patchResponse = await fetch(`/api/contacts/${selectedContact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })

      if (!patchResponse.ok) throw new Error('Failed to update contact')

      await postCallActivity(selectedContact.id, outcome.notes)
      setCallsToday((n) => n + 1)

      if (outcome.status === 'Closed') {
        advanceQueue(selectedContact.id)
      } else {
        setPendingFollowUp({ contactId: selectedContact.id, name: selectedContact.name })
      }
    } catch (actionError) {
      setError('Unable to save the call outcome.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleScheduleFollowUp(days) {
    if (!pendingFollowUp) return
    const { contactId } = pendingFollowUp

    if (days !== null) {
      const date = new Date()
      date.setDate(date.getDate() + days)
      const isoDate = date.toISOString().slice(0, 10)
      await fetch(`/api/contacts/${contactId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ follow_up_at: isoDate }),
      })
    }

    setPendingFollowUp(null)
    advanceQueue(contactId)
  }

  async function handleLogCall(event) {
    event.preventDefault()

    if (!selectedContact || actionLoading || !notes.trim()) {
      return
    }

    setActionLoading(true)
    setError('')

    try {
      await postCallActivity(selectedContact.id, notes.trim())
      setNotes('')
    } catch (logError) {
      setError('Unable to log the call note.')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-white">
      <section className="min-w-0 flex-1 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-gray-900">Call Queue</h1>
          <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">{queue.length} remaining</span>
        </div>

        <div className="mb-4 rounded-md border border-gray-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between text-sm font-medium text-gray-700">
            <span>{callsToday} calls today</span>
            <span className="text-gray-400">Goal: 20</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-100">
            <div className={`h-full rounded-full transition-all ${progressBarColor(callsToday)}`} style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        {error ? <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

        <div className="max-h-[calc(100vh-220px)] overflow-y-auto rounded-md border border-gray-200 bg-white">
          {loading ? (
            <div className="p-6 text-center text-sm text-gray-500">Loading call queue...</div>
          ) : queue.length === 0 ? (
            <div className="flex min-h-64 items-center justify-center p-6 text-center text-sm font-medium text-gray-500">
              Queue clear — no more calls to make today 🎉
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {queue.map((contact) => {
                const followUpAt = isoDate(contact.follow_up_at)

                return (
                  <button
                    key={contact.id}
                    type="button"
                    onClick={() => setSelectedContact(contact)}
                    className={`block w-full px-4 py-3 text-left transition-colors hover:bg-gray-50 ${selectedContact?.id === contact.id ? 'bg-blue-50' : 'bg-white'}`}
                  >
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Avatar name={contact.name} />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold text-gray-900">{contact.name}</div>
                          <div className="truncate text-xs text-gray-500">{contact.school_name || '—'}</div>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap justify-end gap-1">
                        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">{contact.role || '—'}</span>
                        <StatusDot status={contact.status} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className={contact.phone ? 'text-gray-700' : 'text-gray-400'}>{contact.phone || 'No phone'}</span>
                      <span className={`font-medium ${followUpColorClasses(followUpAt, today)}`}>{followUpAt || '—'}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </section>

      <aside className="w-full max-w-md border-l border-gray-200 bg-white p-6">
        {selectedContact ? (
          <div className="space-y-6">
            <div>
              <p className="text-sm font-medium text-gray-500">Active Call</p>
              <div className="mt-1 flex items-center gap-3">
                <Avatar name={selectedContact.name} size="lg" />
                <h2 className="text-2xl font-semibold text-gray-900">{selectedContact.name}</h2>
              </div>
              <p className="mt-1 text-sm text-gray-500">{selectedContact.school_name || '—'}</p>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="font-medium text-gray-500">Role</dt>
                <dd className="mt-1 text-gray-900">{selectedContact.role || '—'}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500">Location</dt>
                <dd className="mt-1 text-gray-900">{locationText(selectedContact)}</dd>
              </div>
              <div className="col-span-2">
                <dt className="font-medium text-gray-500">Email</dt>
                <dd className="mt-1 break-all text-gray-900">{selectedContact.email || '—'}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500">Phone</dt>
                <dd className="mt-2">
                  {selectedContact.phone ? (
                    <a href={`tel:${selectedContact.phone}`} className="inline-flex rounded bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700">
                      Call {selectedContact.phone}
                    </a>
                  ) : (
                    <span className="text-gray-400">No phone</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500">X Handle</dt>
                <dd className="mt-1 text-gray-900">{selectedContact.x_handle || '—'}</dd>
              </div>
            </dl>

            {pendingFollowUp ? (
              <div className="rounded border border-amber-200 bg-amber-50 p-4">
                <p className="mb-3 text-sm font-semibold text-amber-900">Call back {pendingFollowUp.name} when?</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'Tomorrow', days: 1 },
                    { label: '+3 days', days: 3 },
                    { label: '+1 week', days: 7 },
                    { label: '+2 weeks', days: 14 },
                  ].map(({ label, days }) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => handleScheduleFollowUp(days)}
                      className="rounded bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
                    >
                      {label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleScheduleFollowUp(null)}
                    className="rounded border border-amber-300 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-100"
                  >
                    Skip
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {outcomes.map((outcome) => (
                  <button
                    key={outcome.label}
                    type="button"
                    onClick={() => handleOutcome(outcome)}
                    disabled={actionLoading}
                    className={`rounded px-4 py-2 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${outcomeButtonClasses[outcome.label]}`}
                  >
                    {outcome.label}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={handleLogCall} className="space-y-3">
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Add call notes..."
                rows="4"
                className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-400"
              />
              <button
                type="submit"
                disabled={actionLoading || !notes.trim()}
                className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                Log Call
              </button>
            </form>

            <div>
              <h3 className="mb-3 text-sm font-semibold text-gray-900">Recent call history</h3>
              {recentCalls.length === 0 ? (
                <p className="text-sm text-gray-500">No call history yet.</p>
              ) : (
                <ul className="space-y-3">
                  {recentCalls.map((activity) => (
                    <li key={activity.id} className="rounded border border-gray-100 bg-gray-50 p-3">
                      <p className="text-sm text-gray-800">{activity.notes || 'Call logged'}</p>
                      <p className="mt-1 text-xs text-gray-500">{relativeTime(activity.created_at)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <div className="flex h-full min-h-96 items-center justify-center text-center text-sm font-medium text-gray-500">← Select a contact to start calling</div>
        )}
      </aside>
    </div>
  )
}
