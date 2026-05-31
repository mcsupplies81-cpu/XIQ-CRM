import { useEffect, useMemo, useState } from 'react'
import {
  closestCenter,
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Avatar from './Avatar.jsx'

const dealStages = ['Prospecting', 'Qualified', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost']

const stageHeaderClasses = {
  Prospecting: 'bg-violet-600',
  Qualified: 'bg-orange-500',
  Proposal: 'bg-blue-600',
  Negotiation: 'bg-amber-500',
  'Closed Won': 'bg-green-600',
  'Closed Lost': 'bg-gray-500',
}

function groupDeals(deals) {
  return dealStages.reduce((groups, stage) => {
    groups[stage] = deals.filter((deal) => (deal.stage || 'Prospecting') === stage)
    return groups
  }, {})
}

function numericValue(value) {
  if (value === null || value === undefined || value === '') return 0
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : 0
}

function dealProbability(deal) {
  const probability = Number(deal.probability ?? 50)
  if (!Number.isFinite(probability)) return 50
  return Math.min(100, Math.max(0, probability))
}

function formatDealValue(value) {
  return value ? `$${Number(value).toLocaleString()}` : '—'
}

function formatCloseDate(value) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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

function DealCardBody({ deal }) {
  return (
    <>
      <div className="flex items-center gap-3">
        <Avatar name={deal.school_name || deal.title} />
        <div className="min-w-0 text-sm font-semibold text-gray-900 truncate">{deal.title}</div>
      </div>
      <div className="mt-3 space-y-1.5">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="text-gray-400" aria-hidden="true">$</span>
          <span>{formatDealValue(deal.value)}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="text-gray-400" aria-hidden="true">⌂</span>
          <span className="truncate">{deal.school_name || '—'}</span>
        </div>
      </div>
      {deal.close_date ? (
        <div className="mt-3 border-t border-gray-100 pt-2 text-xs text-gray-500">{formatCloseDate(deal.close_date)}</div>
      ) : null}
    </>
  )
}

function DealCard({ deal }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(deal.id),
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? 'transform 200ms ease',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`mb-3 cursor-grab touch-none select-none rounded-lg border border-gray-200 bg-white p-3 transition-opacity ${
        isDragging ? 'opacity-30' : 'shadow-sm hover:shadow-md'
      }`}
    >
      <DealCardBody deal={deal} />
    </div>
  )
}

function DragOverlayCard({ deal }) {
  return (
    <div className="w-[260px] cursor-grabbing rounded-lg border border-blue-300 bg-white p-3 shadow-xl ring-1 ring-blue-200">
      <DealCardBody deal={deal} />
    </div>
  )
}

function DealsPipelineColumn({ stage, deals }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })
  const totals = calculateTotals(deals)
  const stageColor = stageHeaderClasses[stage] || 'bg-gray-600'

  return (
    <section
      className={`flex min-h-[540px] min-w-[260px] shrink-0 flex-col overflow-hidden rounded-lg border transition-colors ${
        isOver ? 'border-blue-400' : 'border-gray-200'
      }`}
    >
      <div className={`${stageColor} rounded-t-lg px-4 py-3 flex items-center justify-between shrink-0`}>
        <span className="text-sm font-bold text-white">{stage}</span>
        <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold text-white">{deals.length}</span>
      </div>
      <SortableContext items={deals.map((deal) => String(deal.id))} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={`flex-1 p-3 transition-colors ${isOver ? 'bg-blue-50' : 'bg-white'}`}
        >
          {deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} />
          ))}
        </div>
      </SortableContext>
      <div className="mx-3 mb-3 shrink-0 border-t border-gray-200 pt-3 text-xs text-gray-600">
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
  const [activeDeal, setActiveDeal] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )

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

  function handleDragStart(event) {
    const found = deals.find((d) => String(d.id) === String(event.active.id))
    setActiveDeal(found || null)
  }

  function handleDragCancel() {
    setActiveDeal(null)
  }

  async function handleDragEnd(event) {
    const { active, over } = event
    setActiveDeal(null)

    if (!over) return

    const dealId = String(active.id)
    const targetColumn = dealStages.includes(String(over.id))
      ? String(over.id)
      : findDealStage(over.id, groupedDeals)
    const activeDealObj = deals.find((deal) => String(deal.id) === dealId)

    if (!targetColumn || !activeDealObj || activeDealObj.stage === targetColumn) return

    const previousDeals = deals
    setDeals((current) =>
      current.map((deal) => (String(deal.id) === dealId ? { ...deal, stage: targetColumn } : deal)),
    )

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
    setDeals((current) =>
      current.map((deal) => (String(deal.id) === dealId ? { ...deal, ...updatedDeal } : deal)),
    )
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

      {error ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}

      {loading ? (
        <div className="rounded-md border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
          Loading deals pipeline...
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="flex gap-4 overflow-x-auto pb-4">
            {dealStages.map((stage) => (
              <DealsPipelineColumn key={stage} stage={stage} deals={groupedDeals[stage]} />
            ))}
          </div>
          <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }}>
            {activeDeal ? <DragOverlayCard deal={activeDeal} /> : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  )
}
