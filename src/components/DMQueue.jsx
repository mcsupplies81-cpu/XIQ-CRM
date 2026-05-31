import { useEffect, useMemo, useState } from 'react'
import { statusBadgeClasses } from './ContactList.jsx'

const DAILY_DM_GOAL = 50
const pendingToggleClass = 'rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50'
const activeToggleClass = 'rounded border border-gray-900 bg-gray-900 px-3 py-1.5 text-sm font-medium text-white transition-colors'

function isoDate(value) {
  return value ? String(value).slice(0, 10) : ''
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(value) {
  const date = isoDate(value)

  if (!date) {
    return ''
  }

  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function normalizeXHandle(handle) {
  return String(handle || '')
    .trim()
    .replace(/^@/, '')
    .replace(/^https?:\/\/(www\.)?x\.com\//i, '')
    .replace(/^https?:\/\/(www\.)?twitter\.com\//i, '')
    .split(/[/?#]/)[0]
}

function compareFollowUps(left, right) {
  const leftDate = isoDate(left.follow_up_at)
  const rightDate = isoDate(right.follow_up_at)

  if (leftDate && rightDate) {
    return leftDate.localeCompare(rightDate) || String(left.name || '').localeCompare(String(right.name || ''))
  }

  if (leftDate) {
    return -1
  }

  if (rightDate) {
    return 1
  }

  return String(left.name || '').localeCompare(String(right.name || ''))
}

export default function DMQueue() {
  const [contacts, setContacts] = useState([])
  const [dmedTodayIds, setDmedTodayIds] = useState(() => new Set())
  const [dmCount, setDmCount] = useState(0)
  const [search, setSearch] = useState('')
  const [pendingOnly, setPendingOnly] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingIds, setUpdatingIds] = useState(() => new Set())

  useEffect(() => {
    let active = true

    async function loadQueue() {
      setLoading(true)
      setError('')

      try {
        const [contactsResponse, todayResponse] = await Promise.all([fetch('/api/contacts'), fetch('/api/activities/today')])

        if (!contactsResponse.ok || !todayResponse.ok) {
          throw new Error('Unable to load DM queue')
        }

        const [contactsData, todayData] = await Promise.all([contactsResponse.json(), todayResponse.json()])

        if (!active) {
          return
        }

        setContacts(contactsData.filter((contact) => contact.assigned_to === 'DMs' && (contact.status || 'New') !== 'Closed'))
        setDmedTodayIds(new Set((todayData.contact_ids_dmed_today || []).map(String)))
        setDmCount(Number(todayData.dm_count || 0))
      } catch (loadError) {
        if (active) {
          setError(loadError.message || 'Unable to load DM queue')
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

  const filteredContacts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return contacts.filter((contact) => {
      const contactId = String(contact.id)
      const alreadySent = dmedTodayIds.has(contactId)
      const matchesSearch =
        !normalizedSearch ||
        contact.name?.toLowerCase().includes(normalizedSearch) ||
        contact.school_name?.toLowerCase().includes(normalizedSearch)
      const matchesPending = !pendingOnly || !alreadySent

      return matchesSearch && matchesPending
    })
  }, [contacts, dmedTodayIds, pendingOnly, search])

  const sortedContacts = useMemo(() => {
    return [...filteredContacts].sort((left, right) => {
      const leftSent = dmedTodayIds.has(String(left.id))
      const rightSent = dmedTodayIds.has(String(right.id))

      if (leftSent !== rightSent) {
        return leftSent ? 1 : -1
      }

      if (leftSent && rightSent) {
        return String(left.name || '').localeCompare(String(right.name || ''))
      }

      return compareFollowUps(left, right)
    })
  }, [dmedTodayIds, filteredContacts])

  const firstSentIndex = sortedContacts.findIndex((contact) => dmedTodayIds.has(String(contact.id)))
  const showAllDone = !loading && !error && (contacts.length === 0 || contacts.every((contact) => dmedTodayIds.has(String(contact.id))))
  const goalProgress = Math.min(100, (dmCount / DAILY_DM_GOAL) * 100)
  const progressColor = dmCount >= DAILY_DM_GOAL ? 'bg-green-500' : dmCount >= 25 ? 'bg-amber-500' : 'bg-gray-400'
  const today = todayIsoDate()

  async function markAsDmed(contactId) {
    const normalizedId = String(contactId)

    if (dmedTodayIds.has(normalizedId) || updatingIds.has(normalizedId)) {
      return
    }

    setDmedTodayIds((current) => new Set(current).add(normalizedId))
    setDmCount((current) => current + 1)
    setUpdatingIds((current) => new Set(current).add(normalizedId))
    setError('')

    try {
      const activityResponse = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: normalizedId, type: 'dm', notes: 'DM sent' }),
      })

      if (!activityResponse.ok) {
        throw new Error('Unable to mark DM as sent')
      }

      const contactResponse = await fetch(`/api/contacts/${normalizedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Emailed' }),
      })

      if (!contactResponse.ok) {
        throw new Error('Unable to update contact status')
      }

      setContacts((current) => current.map((contact) => (String(contact.id) === normalizedId ? { ...contact, status: 'Emailed' } : contact)))
    } catch (markError) {
      setDmedTodayIds((current) => {
        const next = new Set(current)
        next.delete(normalizedId)
        return next
      })
      setDmCount((current) => Math.max(0, current - 1))
      setError(markError.message || 'Unable to mark DM as sent')
    } finally {
      setUpdatingIds((current) => {
        const next = new Set(current)
        next.delete(normalizedId)
        return next
      })
    }
  }

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 grid gap-4 md:grid-cols-[1fr_320px] md:items-stretch">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="mb-2 text-sm font-medium uppercase tracking-wide text-sky-600">Garrett's daily checklist</p>
            <h1 className="text-3xl font-semibold text-gray-900">DM Queue</h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-500">Work every open contact assigned to DMs and keep the daily outreach goal in view.</p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-4xl font-semibold text-gray-900">{dmCount} / {DAILY_DM_GOAL}</span>
                {dmCount >= DAILY_DM_GOAL ? <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">🎯 Goal reached!</span> : null}
              </div>
            </div>
            <div className="mb-2 h-3 overflow-hidden rounded-full bg-gray-100">
              <div className={`h-full rounded-full transition-all ${progressColor}`} style={{ width: `${goalProgress}%` }} />
            </div>
            <p className="text-sm font-medium text-gray-500">DMs sent today</p>
          </div>
        </header>

        <section className="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by contact or school"
              className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-sky-400 md:max-w-sm"
            />
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPendingOnly(false)} className={!pendingOnly ? activeToggleClass : pendingToggleClass}>
                Show all
              </button>
              <button type="button" onClick={() => setPendingOnly(true)} className={pendingOnly ? activeToggleClass : pendingToggleClass}>
                Pending only
              </button>
            </div>
          </div>
        </section>

        {error ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        {loading ? (
          <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500 shadow-sm">Loading DM queue...</div>
        ) : showAllDone ? (
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-lg font-semibold text-gray-700 shadow-sm">All done for today! 🎯</div>
        ) : sortedContacts.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500 shadow-sm">No contacts match these filters.</div>
        ) : (
          <div className="space-y-2">
            {sortedContacts.map((contact, index) => {
              const contactId = String(contact.id)
              const sentToday = dmedTodayIds.has(contactId)
              const handle = normalizeXHandle(contact.x_handle)
              const followUpDate = isoDate(contact.follow_up_at)
              const isOverdue = followUpDate && followUpDate < today

              return (
                <div key={contactId}>
                  {firstSentIndex === index ? (
                    <div className="flex items-center gap-3 py-3 text-xs font-medium uppercase tracking-wide text-gray-400">
                      <span className="h-px flex-1 bg-gray-200" />
                      <span>— already sent today —</span>
                      <span className="h-px flex-1 bg-gray-200" />
                    </div>
                  ) : null}

                  <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-sky-200">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="flex min-w-0 gap-3">
                        <input
                          type="checkbox"
                          checked={sentToday}
                          disabled={sentToday || updatingIds.has(contactId)}
                          onChange={() => markAsDmed(contactId)}
                          aria-label={`Mark ${contact.name} as DMed`}
                          className="mt-1 h-5 w-5 rounded border-gray-300 text-sky-600 disabled:cursor-not-allowed disabled:opacity-70"
                        />
                        <div className="min-w-0">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <h2 className="font-semibold text-gray-900">{contact.name}</h2>
                            {contact.role ? <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">{contact.role}</span> : null}
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClasses[contact.status || 'New'] || 'bg-gray-100 text-gray-700'}`}>{contact.status || 'New'}</span>
                          </div>
                          <p className="mb-2 text-sm text-gray-500">{contact.school_name || 'No school listed'}</p>
                          {handle ? (
                            <a href={`https://x.com/${handle}`} target="_blank" rel="noreferrer" className="text-sm font-medium text-sky-600 hover:text-sky-700 hover:underline">
                              x.com/{handle}
                            </a>
                          ) : (
                            <span className="text-sm font-medium text-red-600">No X handle</span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 md:justify-end">
                        {sentToday ? <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700">Sent today</span> : null}
                        {isOverdue ? <span className="text-sm font-semibold text-red-600">Due {formatDate(followUpDate)}</span> : null}
                      </div>
                    </div>
                  </article>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
