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

function formatCurrency(value) {
  if (!value) return '$0'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value))
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
  const pipelineByStage = dashboard?.pipeline_by_stage || []
  const totalPipelineValue = useMemo(() => pipelineByStage.reduce((sum, row) => sum + Number(row.total_value), 0), [pipelineByStage])

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

  const isEmpty = totalContacts === 0 && dashboard.total_schools === 0

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">A quick overview of CRM activity and pipeline health.</p>
      </div>

      {isEmpty ? (
        <div className="rounded border border-dashed border-gray-300 bg-white px-8 py-16 text-center">
          <p className="text-lg font-semibold text-gray-900">No data yet</p>
          <p className="mt-2 text-sm text-gray-500">Import your contacts to get started. Everything will populate from there.</p>
          <Link to="/import" className="mt-4 inline-block rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700">
            Go to Import
          </Link>
        </div>
      ) : (
        <>
      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Schools" value={dashboard.total_schools} />
        <StatCard label="Total Contacts" value={totalContacts} />
        <StatCard label="Open Deals" value={dashboard.open_deals} />
      </section>

      {pipelineByStage.length > 0 ? (
        <section className="rounded border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Pipeline by Stage</h2>
              <p className="text-sm text-gray-500">{formatCurrency(totalPipelineValue)} open pipeline</p>
            </div>
            <Link to="/deals" className="text-sm text-blue-600 hover:underline">View all deals →</Link>
          </div>
          <div className="space-y-3">
            {pipelineByStage.map((row) => (
              <div key={row.stage} className="flex items-center justify-between gap-4 text-sm">
                <span className="w-36 font-medium text-gray-700">{row.stage}</span>
                <div className="flex-1 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-2 rounded-full bg-violet-500 transition-all"
                    style={{ width: totalPipelineValue ? `${Math.min(100, (Number(row.total_value) / totalPipelineValue) * 100)}%` : '0%' }}
                  />
                </div>
                <span className="w-24 text-right text-gray-500">{formatCurrency(row.total_value)}</span>
                <span className="w-16 text-right text-gray-400">{row.deal_count} deal{row.deal_count !== 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">Team today</h2>
        <div className="space-y-4">
          {[
            { name: 'Malcolm', label: 'calls', count: Number(activityToday.calls_today) || 0, goal: 20, color: 'bg-green-500' },
            { name: 'Garrett', label: 'DMs', count: Number(activityToday.dms_today) || 0, goal: 50, color: 'bg-sky-500' },
          ].map(({ name, label, count, goal, color }) => (
            <div key={name}>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">{name} <span className="font-normal text-gray-400">· {label}</span></span>
                <span className="tabular-nums text-gray-500">{count} <span className="text-gray-400">/ {goal}</span></span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(100, (count / goal) * 100)}%` }} />
              </div>
            </div>
          ))}
          <p className="pt-1 text-sm text-gray-500">
            Emails today: <span className="font-semibold text-blue-600">{Number(activityToday.emails_today) || 0}</span>
          </p>
        </div>
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
                <Link key={contact.id} to="/contacts?filter=overdue" className="block px-5 py-4 transition-colors hover:bg-gray-50">
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
        </>
      )}
    </div>
  )
}
