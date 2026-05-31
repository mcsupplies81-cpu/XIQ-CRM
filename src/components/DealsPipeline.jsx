import { useEffect, useMemo, useState } from 'react'
import { DndContext, useDroppable } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Avatar from './Avatar.jsx'

const dealStages = ['Prospecting', 'Qualified', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost']

const stageBadgeClasses = {
  Prospecting: 'bg-gray-100 text-gray-700',
  Qualified: 'bg-purple-100 text-purple-700',
  Proposal: 'bg-blue-100 text-blue-700',
  Negotiation: 'bg-amber-100 text-amber-700',
  'Closed Won': 'bg-emerald-100 text-emerald-700',
  'Closed Lost': 'bg-red-100 text-red-700',
}

function groupDeals(deals) {
  return dealStages.reduce((groups, stage) => {
    groups[stage] = deals.filter((deal) => (deal.stage || 'Prospecting') === stage)
    return groups
  }, {})
}

function numericValue(value) {
  if (value === null || value === undefined || value === '') {
    return 0
  }

  const amount = Number(value)
  return Number.isFinite(amount) ? amount : 0
}

function dealProbability(deal) {
  const probability = Number(deal.probability ?? 50)

  if (!Number.isFinite(probability)) {
    return 50
  }

  return Math.min(100, Math.max(0, probability))
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === '') {
    return '—'
  }

  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value))
}

function formatTotal(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

function calculateTotals(deals) {
  return deals.reduce(
    (totals, deal) => {
      const value = numericValue(deal.value)
      totals.value += value
      totals.weighted += value * (dealProbability(deal) / 100)
      return totals
    },
    { value: 0, weighted: 0 },
  )
}

function ForecastCard({ label, value }) {
  return (
    <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-gray-900">{formatTotal(value)}</div>
    </div>
  )
}

function DealCard({ deal }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: String(deal.id) })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="mb-2 cursor-grab rounded border border-gray-200 bg-white p-3 shadow-sm transition-colors hover:border-gray-300">
      <div className="flex items-start gap-2.5">
        <Avatar name={deal.school_name || deal.title} />
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-gray-900">{deal.title}</div>
          <div className="mt-1 truncate text-xs text-gray-500">{deal.school_name || '—'}</div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-gray-900">{formatCurrency(deal.value)}</span>
        <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">{dealProbability(deal)}%</span>
      </div>
    </div>
  )
}

function DealsPipelineColumn({ stage, deals }) {
  const { setNodeRef } = useDroppable({ id: stage })
  const totals = calculateTotals(deals)

  return (
    <section ref={setNodeRef} className="flex min-h-[540px] w-64 shrink-0 flex-col rounded-md border border-gray-200 bg-gray-50 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${stageBadgeClasses[stage]}`}>{stage}</span>
        <span className="text-xs text-gray-500">{deals.length}</span>
      </div>
      <SortableContext items={deals.map((deal) => String(deal.id))} strategy={verticalListSortingStrategy}>
        <div className="flex-1">
          {deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} />
          ))}
        </div>
      </SortableContext>
      <div className="mt-3 border-t border-gray-200 pt-3 text-xs text-gray-600">
        <div className="flex items-center justify-between gap-3">
          <span>Total:</span>
          <span className="font-semibold text-gray-900">{formatTotal(totals.value)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-3">
          <span>Wtd:</span>
          <span className="font-semibold text-gray-900">{formatTotal(totals.weighted)}</span>
        </div>
      </div>
    </section>
  )
}

export default function DealsPipeline() {
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function loadDeals() {
      setLoading(true)
      setError('')
      const response = await fetch('/api/deals')
      const data = response.ok ? await response.json() : []

      if (active) {
        setDeals(data)
        setError(response.ok ? '' : 'Unable to load deals pipeline.')
        setLoading(false)
      }
    }

    loadDeals()

    return () => {
      active = false
    }
  }, [])

  const groupedDeals = useMemo(() => groupDeals(deals), [deals])
  const forecast = useMemo(() => {
    return deals.reduce(
      (totals, deal) => {
        const value = numericValue(deal.value)

        if (deal.stage === 'Closed Won') {
          totals.closedWon += value
        } else if (deal.stage !== 'Closed Lost') {
          totals.pipeline += value
          totals.weighted += value * (dealProbability(deal) / 100)
        }

        return totals
      },
      { pipeline: 0, weighted: 0, closedWon: 0 },
    )
  }, [deals])

  function findDealStage(dealId, groups) {
    return dealStages.find((stage) => groups[stage].some((deal) => String(deal.id) === String(dealId)))
  }

  async function handleDragEnd(event) {
    const { active, over } = event

    if (!over) {
      return
    }

    const dealId = String(active.id)
    const targetColumn = dealStages.includes(String(over.id)) ? String(over.id) : findDealStage(over.id, groupedDeals)
    const activeDeal = deals.find((deal) => String(deal.id) === dealId)

    if (!targetColumn || !activeDeal || activeDeal.stage === targetColumn) {
      return
    }

    const previousDeals = deals
    setDeals((current) => current.map((deal) => (String(deal.id) === dealId ? { ...deal, stage: targetColumn } : deal)))

    const response = await fetch(`/api/deals/${dealId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: targetColumn }),
    })

    if (!response.ok) {
      setDeals(previousDeals)
      setError('Unable to update deal stage.')
      return
    }

    const updatedDeal = await response.json()
    setDeals((current) => current.map((deal) => (String(deal.id) === dealId ? { ...deal, ...updatedDeal } : deal)))
    setError('')
  }

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-gray-900">Deals Board</h1>
        <p className="mt-1 text-sm text-gray-500">Track deal stages, pipeline value, and weighted forecast.</p>
      </div>

      <div className="mb-5 grid gap-3 md:grid-cols-3">
        <ForecastCard label="Pipeline" value={forecast.pipeline} />
        <ForecastCard label="Weighted Forecast" value={forecast.weighted} />
        <ForecastCard label="Closed Won" value={forecast.closedWon} />
      </div>

      {error ? <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      {loading ? (
        <div className="rounded-md border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">Loading deals pipeline...</div>
      ) : (
        <DndContext onDragEnd={handleDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-4">
            {dealStages.map((stage) => (
              <DealsPipelineColumn key={stage} stage={stage} deals={groupedDeals[stage]} />
            ))}
          </div>
        </DndContext>
      )}
    </div>
  )
}
