import { useEffect, useState } from 'react'

const stages = ['Prospecting', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost']

const stageBadgeClasses = {
  Prospecting: 'bg-gray-100 text-gray-700',
  Proposal: 'bg-blue-100 text-blue-700',
  Negotiation: 'bg-amber-100 text-amber-700',
  'Closed Won': 'bg-emerald-100 text-emerald-700',
  'Closed Lost': 'bg-red-100 text-red-700',
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === '') {
    return '—'
  }

  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value))
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : '—'
}

function dateInputValue(value) {
  return value ? String(value).slice(0, 10) : ''
}

export default function DealDetail({ deal, onClose, onDealUpdated, onDealDeleted }) {
  const [stage, setStage] = useState(deal.stage || 'Prospecting')
  const [value, setValue] = useState(deal.value ?? '')
  const [closeDate, setCloseDate] = useState(dateInputValue(deal.close_date))
  const [notes, setNotes] = useState(deal.notes || '')
  const [nextAction, setNextAction] = useState(deal.next_action || '')
  const [originalValue, setOriginalValue] = useState(deal.value ?? '')
  const [originalNotes, setOriginalNotes] = useState(deal.notes || '')
  const [originalNextAction, setOriginalNextAction] = useState(deal.next_action || '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setStage(deal.stage || 'Prospecting')
    setValue(deal.value ?? '')
    setCloseDate(dateInputValue(deal.close_date))
    setNotes(deal.notes || '')
    setNextAction(deal.next_action || '')
    setOriginalValue(deal.value ?? '')
    setOriginalNotes(deal.notes || '')
    setOriginalNextAction(deal.next_action || '')
  }, [deal])

  async function patchDeal(payload) {
    setSaving(true)
    const response = await fetch(`/api/deals/${deal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      setSaving(false)
      throw new Error('Unable to update deal')
    }

    const updatedDeal = await response.json()
    onDealUpdated({ ...deal, ...updatedDeal, ...payload })
    setSaving(false)
    return updatedDeal
  }

  async function handleStageChange(event) {
    const nextStage = event.target.value
    const previousStage = stage
    setStage(nextStage)
    onDealUpdated({ ...deal, stage: nextStage })

    try {
      await patchDeal({ stage: nextStage })
    } catch {
      setStage(previousStage)
      onDealUpdated({ ...deal, stage: previousStage })
    }
  }

  async function handleValueBlur() {
    if (String(value ?? '') === String(originalValue ?? '')) {
      return
    }

    const previousValue = originalValue

    try {
      await patchDeal({ value: value === '' ? null : value })
      setOriginalValue(value)
    } catch {
      setValue(previousValue)
    }
  }

  async function handleCloseDateChange(event) {
    const nextCloseDate = event.target.value
    const previousCloseDate = closeDate
    setCloseDate(nextCloseDate)

    try {
      await patchDeal({ close_date: nextCloseDate || null })
    } catch {
      setCloseDate(previousCloseDate)
    }
  }

  async function handleNotesBlur() {
    if (notes === originalNotes) {
      return
    }

    const previousNotes = originalNotes

    try {
      await patchDeal({ notes })
      setOriginalNotes(notes)
    } catch {
      setNotes(previousNotes)
    }
  }

  async function handleNextActionBlur() {
    if (nextAction === originalNextAction) {
      return
    }

    const previousNextAction = originalNextAction

    try {
      await patchDeal({ next_action: nextAction || null })
      setOriginalNextAction(nextAction)
    } catch {
      setNextAction(previousNextAction)
    }
  }

  async function handleDelete() {
    const response = await fetch(`/api/deals/${deal.id}`, { method: 'DELETE' })

    if (response.ok) {
      onDealDeleted(deal.id)
    }
  }

  return (
    <aside className="w-[420px] flex-shrink-0 border-l border-gray-200 bg-white p-6 min-h-screen">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{deal.title}</h2>
          <p className="mt-1 text-sm text-gray-500">{formatCurrency(deal.value)} · {formatDate(deal.close_date)}</p>
        </div>
        <button type="button" onClick={onClose} className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50">
          Close
        </button>
      </div>

      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Stage</span>
          <select
            value={stage}
            onChange={handleStageChange}
            className={`w-full rounded border border-gray-300 px-3 py-2 text-sm font-medium outline-none ${stageBadgeClasses[stage] || stageBadgeClasses.Prospecting}`}
          >
            {stages.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Value</span>
          <div className="flex rounded border border-gray-300 bg-white">
            <span className="border-r border-gray-200 px-3 py-2 text-sm text-gray-500">$</span>
            <input
              type="number"
              min="0"
              value={value ?? ''}
              onChange={(event) => setValue(event.target.value)}
              onBlur={handleValueBlur}
              className="min-w-0 flex-1 px-3 py-2 text-sm text-gray-900 outline-none"
            />
          </div>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Close Date</span>
          <input
            type="date"
            value={closeDate}
            onChange={handleCloseDateChange}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Next Action</span>
          <input
            type="text"
            value={nextAction}
            onChange={(event) => setNextAction(event.target.value)}
            onBlur={handleNextActionBlur}
            placeholder="e.g. Send proposal, Follow up call..."
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none"
          />
        </label>

        <div className="grid grid-cols-2 gap-3 border-b border-gray-100 pb-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500">School</div>
            <div className="mt-1 text-sm text-gray-900">{deal.school_name || '—'}</div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Contact</div>
            <div className="mt-1 text-sm text-gray-900">{deal.contact_name || '—'}</div>
          </div>
        </div>

        <label className="block border-b border-gray-100 pb-4">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Notes</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            onBlur={handleNotesBlur}
            rows="8"
            className="w-full rounded border border-gray-200 p-2 text-sm text-gray-900 outline-none"
          />
        </label>

        {saving ? <p className="text-xs text-gray-500">Saving...</p> : null}
      </div>

      <button
        type="button"
        onClick={handleDelete}
        className="mt-8 rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-50"
      >
        Delete Deal
      </button>
    </aside>
  )
}
