import { useCallback, useEffect, useState } from 'react'

function StatCard({ label, value, sub, color = 'text-gray-900' }) {
  return (
    <div className="rounded border border-gray-200 bg-white p-5 shadow-sm">
      <div className={`text-3xl font-bold ${color}`}>{value ?? '—'}</div>
      <div className="mt-1 text-sm font-medium text-gray-500">{label}</div>
      {sub && <div className="mt-0.5 text-xs text-gray-400">{sub}</div>}
    </div>
  )
}

function StepBadge({ step }) {
  const labels = ['Step 1', 'Step 2', 'Step 3']
  const colors = ['bg-blue-100 text-blue-700', 'bg-amber-100 text-amber-700', 'bg-purple-100 text-purple-700']
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${colors[step] || 'bg-gray-100 text-gray-600'}`}>
      {labels[step] || `Step ${step + 1}`}
    </span>
  )
}

function formatTime(val) {
  if (!val) return '—'
  const d = new Date(val)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function OutboundDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const res = await fetch('/api/outbound')
    if (!res.ok) throw new Error('Failed to load outbound stats')
    return res.json()
  }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    load()
      .then(d => { if (active) { setData(d); setLoading(false) } })
      .catch(e => { if (active) { setError(e.message); setLoading(false) } })
    return () => { active = false }
  }, [load])

  useEffect(() => {
    const interval = setInterval(() => load().then(setData).catch(() => {}), 30_000)
    return () => clearInterval(interval)
  }, [load])

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="grid gap-4 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 animate-pulse rounded bg-gray-200" />)}
        </div>
        <div className="h-64 animate-pulse rounded bg-gray-200" />
      </div>
    )
  }

  if (error) {
    return <div className="p-6"><div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div></div>
  }

  const { overview, email_stats, by_step, top_subjects, recent_sends, reply_stats } = data
  const totalSent = Number(email_stats?.total_sent) || 0
  const hasData = totalSent > 0

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Outbound</h1>
        <p className="mt-1 text-sm text-gray-500">Email pipeline performance and sequence health.</p>
      </div>

      {/* Sequence overview */}
      <section className="grid gap-4 sm:grid-cols-4">
        <StatCard label="In Sequence" value={Number(overview?.active) + Number(overview?.queued)} />
        <StatCard label="Emails Sent" value={totalSent} />
        <StatCard
          label="Open Rate"
          value={hasData ? `${email_stats.open_rate_pct ?? 0}%` : '—'}
          sub={hasData ? `${email_stats.total_opened} of ${totalSent} opened` : null}
          color={hasData && Number(email_stats.open_rate_pct) >= 20 ? 'text-green-600' : 'text-gray-900'}
        />
        <StatCard
          label="Reply Rate"
          value={hasData ? `${reply_stats?.reply_rate_pct ?? 0}%` : '—'}
          sub={hasData ? `${reply_stats?.total_replies} replies` : null}
          color={hasData && Number(reply_stats?.reply_rate_pct) >= 5 ? 'text-green-600' : 'text-gray-900'}
        />
      </section>

      {/* Sequence status breakdown */}
      <section className="rounded border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">Sequence Status</h2>
        <div className="grid gap-4 sm:grid-cols-5 text-center">
          {[
            { label: 'Queued', value: overview?.queued, color: 'text-gray-500' },
            { label: 'Active', value: overview?.active, color: 'text-blue-600' },
            { label: 'Completed', value: overview?.completed, color: 'text-green-600' },
            { label: 'Replied', value: overview?.replied, color: 'text-purple-600' },
            { label: 'Bounced', value: overview?.bounced, color: 'text-red-500' },
          ].map(({ label, value, color }) => (
            <div key={label}>
              <div className={`text-2xl font-bold ${color}`}>{Number(value) || 0}</div>
              <div className="mt-1 text-xs text-gray-500">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* By step */}
      {by_step.length > 0 && (
        <section className="rounded border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Performance by Step</h2>
          <div className="space-y-3">
            {by_step.map(row => (
              <div key={row.step} className="flex items-center gap-4 text-sm">
                <StepBadge step={Number(row.step)} />
                <span className="w-16 text-gray-500">{row.sent} sent</span>
                <div className="flex-1 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-2 rounded-full bg-blue-500 transition-all"
                    style={{ width: `${Math.min(100, Number(row.open_rate_pct) || 0)}%` }}
                  />
                </div>
                <span className="w-20 text-right font-medium text-gray-700">{row.open_rate_pct ?? 0}% open</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Top subjects */}
      {top_subjects.length > 0 && (
        <section className="rounded border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Subject Lines — What's Working</h2>
            <p className="mt-0.5 text-xs text-gray-400">Minimum 3 sends. Sorted by open rate.</p>
          </div>
          <div className="divide-y divide-gray-100">
            {top_subjects.map((row, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3 text-sm">
                <span className={`w-12 text-right font-bold ${Number(row.open_rate_pct) >= 30 ? 'text-green-600' : Number(row.open_rate_pct) >= 15 ? 'text-amber-600' : 'text-gray-400'}`}>
                  {row.open_rate_pct ?? 0}%
                </span>
                <span className="flex-1 text-gray-800">{row.subject}</span>
                <span className="text-gray-400 text-xs">{row.opened}/{row.sent}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent sends */}
      <section className="overflow-hidden rounded border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Recent Sends</h2>
        </div>
        {recent_sends.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">
            No emails sent yet. First batch goes out at 7:30 AM PT tomorrow.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-5 py-3">Contact</th>
                  <th className="px-5 py-3">School</th>
                  <th className="px-5 py-3">Subject</th>
                  <th className="px-5 py-3">Step</th>
                  <th className="px-5 py-3">Sent</th>
                  <th className="px-5 py-3">Opened</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recent_sends.map(row => (
                  <tr key={row.id}>
                    <td className="px-5 py-3 font-medium text-gray-900">
                      {row.contact_name}
                      <span className="ml-1.5 text-xs font-normal text-gray-400">{row.contact_role}</span>
                    </td>
                    <td className="px-5 py-3 text-gray-500">{row.school_name}, {row.school_state}</td>
                    <td className="px-5 py-3 text-gray-700 max-w-xs truncate">{row.subject}</td>
                    <td className="px-5 py-3"><StepBadge step={Number(row.step)} /></td>
                    <td className="px-5 py-3 text-gray-400 whitespace-nowrap">{formatTime(row.sent_at)}</td>
                    <td className="px-5 py-3">
                      {row.opened_at
                        ? <span className="text-green-600 font-medium">Opened {row.open_count > 1 ? `(${row.open_count}x)` : ''}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
