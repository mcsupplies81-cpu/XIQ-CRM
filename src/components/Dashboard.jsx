import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import StatusDot from './StatusDot.jsx'

const statuses = ['New', 'Emailed', 'Called', 'Responded', 'Closed']

const statusBarClasses = {
  New: 'bg-gray-400',
  Emailed: 'bg-blue-500',
  Called: 'bg-amber-500',
  Responded: 'bg-purple-500',
  Closed: 'bg-green-500',
}


const typeBadgeClasses = {
  call: 'bg-amber-100 text-amber-700',
  email: 'bg-blue-100 text-blue-700',
  dm: 'bg-purple-100 text-purple-700',
}

function formatRelativeTime(value) {
  if (!value) {
    return '—'
  }

  const timestamp = new Date(value).getTime()

  if (Number.isNaN(timestamp)) {
    return '—'
  }

  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000))
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) {
    return `${days}d ago`
  }

  if (hours > 0) {
    return `${hours}h ago`
  }

  if (minutes > 0) {
    return `${minutes}m ago`
  }

  return 'just now'
}

function formatDaysAgo(value) {
  if (!value) {
    return '—'
  }

  const timestamp = new Date(value).getTime()

  if (Number.isNaN(timestamp)) {
    return '—'
  }

  const days = Math.floor((Date.now() - timestamp) / 86400000)
  return `${Math.max(0, days)} days ago`
}

function truncateNotes(notes) {
  if (!notes) {
    return '—'
  }

  return notes.length > 60 ? `${notes.slice(0, 60)}...` : notes
}

function StatCard({ label, value }) {
  return (
    <div className="rounded border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-3xl font-bold text-gray-900">{value}</div>
      <div className="mt-1 text-sm font-medium text-gray-500">{label}</div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 p-6">
      <div className="h-24 animate-pulse rounded-md bg-gray-200" />
      <div className="h-36 animate-pulse rounded-md bg-gray-200" />
      <div className="h-72 animate-pulse rounded-md bg-gray-200" />
    </div>
  )
}

export default function Dashboard() {
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function loadDashboard() {
      setLoading(true)
      setError('')

      try {
        const response = await fetch('/api/dashboard')

        if (!response.ok) {
          throw new Error('Unable to load dashboard')
        }

        const data = await response.json()

        if (active) {
          setDashboard(data)
        }
      } catch (loadError) {
        if (active) {
          setError(loadError.message)
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadDashboard()

    return () => {
      active = false
    }
  }, [])

  const contactsByStatus = dashboard?.contacts_by_status || {}
  const totalContacts = useMemo(() => statuses.reduce((total, status) => total + (Number(contactsByStatus[status]) || 0), 0), [contactsByStatus])
  const activityToday = dashboard?.activity_today || {}
  const overdueFollowUps = dashboard?.overdue_follow_ups || []
  const staleDeals = dashboard?.stale_deals || []

  if (loading) {
    return <LoadingSkeleton />
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">A quick overview of CRM activity and pipeline health.</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Schools" value={dashboard.total_schools} />
        <StatCard label="Total Contacts" value={totalContacts} />
        <StatCard label="Open Deals" value={dashboard.open_deals} />
      </section>

      <section className="rounded border border-gray-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-medium text-gray-700">
          Today:{' '}
          <span className="font-semibold text-green-600">{Number(activityToday.calls_today) || 0} calls</span>
          <span className="text-gray-400"> · </span>
          <span className="font-semibold text-sky-600">{Number(activityToday.dms_today) || 0} DMs</span>
          <span className="text-gray-400"> · </span>
          <span className="font-semibold text-blue-600">{Number(activityToday.emails_today) || 0} emails</span>
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Overdue Follow-ups</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {overdueFollowUps.length === 0 ? (
              <div className="px-5 py-6 text-sm font-medium text-green-600">No overdue follow-ups ✓</div>
            ) : (
              overdueFollowUps.map((contact) => (
                <Link key={contact.id} to="/contacts" className="block px-5 py-4 transition-colors hover:bg-gray-50">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{contact.name}</p>
                      <p className="mt-1 text-sm text-gray-500">{contact.school_name || '—'}</p>
                      <div className="mt-2">
                        <StatusDot status={contact.status} />
                      </div>
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      <p className="font-medium text-red-600">{formatDaysAgo(contact.follow_up_at)}</p>
                      <p className="mt-1">{contact.assigned_to || 'Unassigned'}</p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="rounded border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Stale Deals</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {staleDeals.length === 0 ? (
              <div className="px-5 py-6 text-sm font-medium text-green-600">All deals up to date ✓</div>
            ) : (
              staleDeals.map((deal) => (
                <Link key={deal.id} to="/deals" className="block px-5 py-4 transition-colors hover:bg-gray-50">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">{deal.title}</p>
                        <span className="rounded bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">{deal.stage || '—'}</span>
                      </div>
                      <p className="mt-1 text-sm text-gray-500">{deal.school_name || '—'}</p>
                    </div>
                    <p className="whitespace-nowrap text-xs font-medium text-gray-500">{formatDaysAgo(deal.updated_at)}</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="rounded border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Contacts by Status</h2>
            <p className="text-sm text-gray-500">{totalContacts} total contacts</p>
          </div>
        </div>

        <div className="flex h-5 overflow-hidden rounded-full bg-gray-100">
          {totalContacts === 0 ? (
            <div className="h-full w-full bg-gray-200" />
          ) : (
            statuses.map((status) => (
              <div
                key={status}
                title={`${status}: ${contactsByStatus[status] || 0}`}
                className={`${statusBarClasses[status]} transition-all`}
                style={{ flexGrow: contactsByStatus[status] || 0, flexBasis: 0 }}
              />
            ))
          )}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-5">
          {statuses.map((status) => (
            <div key={status} className="flex items-center gap-2 text-sm text-gray-600">
              <StatusDot status={status} />
              <span>{contactsByStatus[status] || 0}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Contact</th>
                <th className="px-5 py-3 font-medium">School</th>
                <th className="px-5 py-3 font-medium">Notes</th>
                <th className="px-5 py-3 font-medium">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {dashboard.recent_activities.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-5 py-6 text-center text-sm text-gray-500">No recent activity yet.</td>
                </tr>
              ) : (
                dashboard.recent_activities.map((activity) => (
                  <tr key={activity.id}>
                    <td className="px-5 py-3">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${typeBadgeClasses[activity.type] || 'bg-gray-100 text-gray-700'}`}>
                        {activity.type || '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm font-medium text-gray-900">{activity.contact_name || '—'}</td>
                    <td className="px-5 py-3 text-sm text-gray-500">{activity.school_name || '—'}</td>
                    <td className="px-5 py-3 text-sm text-gray-500">{truncateNotes(activity.notes)}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-sm text-gray-500">{formatRelativeTime(activity.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
