import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const navItems = [
  { type: 'page', label: 'Dashboard', path: '/dashboard', indicator: 'bg-rose-400' },
  { type: 'page', label: 'Schools', path: '/schools', indicator: 'bg-emerald-400' },
  { type: 'page', label: 'Contacts', path: '/contacts', indicator: 'bg-blue-400' },
  { type: 'page', label: 'Call Queue', path: '/calls', indicator: 'bg-green-400' },
  { type: 'page', label: 'Deals', path: '/deals', indicator: 'bg-violet-400' },
  { type: 'page', label: 'Deals Board', path: '/deals-pipeline', indicator: 'bg-orange-400' },
  { type: 'page', label: 'Pipeline', path: '/pipeline', indicator: 'bg-amber-400' },
  { type: 'page', label: 'Templates', path: '/templates', indicator: 'bg-teal-400' },
  { type: 'page', label: 'DM Queue', path: '/dms', indicator: 'bg-sky-400' },
  { type: 'page', label: 'Import', path: '/import', indicator: 'bg-gray-400' },
]

const searchableTags = ['INPUT', 'TEXTAREA', 'SELECT']

function matchesQuery(value, query) {
  return String(value || '').toLowerCase().includes(query)
}

export default function CommandPalette() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [contacts, setContacts] = useState([])
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const hasFetchedRef = useRef(false)

  useEffect(() => {
    function handleGlobalKeydown(event) {
      const activeTag = document.activeElement?.tagName
      const isTyping = searchableTags.includes(activeTag)

      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen(true)
        return
      }

      if (event.key === '/' && !isTyping) {
        event.preventDefault()
        setOpen(true)
      }
    }

    document.addEventListener('keydown', handleGlobalKeydown)
    return () => document.removeEventListener('keydown', handleGlobalKeydown)
  }, [])

  useEffect(() => {
    if (!open || hasFetchedRef.current) {
      return
    }

    let active = true
    hasFetchedRef.current = true

    async function loadResults() {
      setLoading(true)
      try {
        const [contactsResponse, dealsResponse] = await Promise.all([fetch('/api/contacts'), fetch('/api/deals')])
        const [contactsData, dealsData] = await Promise.all([
          contactsResponse.ok ? contactsResponse.json() : Promise.resolve([]),
          dealsResponse.ok ? dealsResponse.json() : Promise.resolve([]),
        ])

        if (active) {
          setContacts(Array.isArray(contactsData) ? contactsData : [])
          setDeals(Array.isArray(dealsData) ? dealsData : [])
        }
      } catch {
        if (active) {
          setContacts([])
          setDeals([])
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadResults()

    return () => {
      active = false
    }
  }, [open])

  useEffect(() => {
    setHighlightedIndex(0)
  }, [query])

  const normalizedQuery = query.trim().toLowerCase()

  const sections = useMemo(() => {
    const pages = normalizedQuery ? navItems.filter((item) => matchesQuery(item.label, normalizedQuery)) : navItems

    if (!normalizedQuery) {
      return [{ title: 'Pages', items: pages }]
    }

    const contactResults = contacts
      .filter((contact) => matchesQuery(contact.name, normalizedQuery) || matchesQuery(contact.school_name, normalizedQuery))
      .slice(0, 5)
      .map((contact) => ({ ...contact, type: 'contact' }))

    const dealResults = deals
      .filter((deal) => matchesQuery(deal.title, normalizedQuery) || matchesQuery(deal.school_name, normalizedQuery))
      .slice(0, 5)
      .map((deal) => ({ ...deal, type: 'deal' }))

    return [
      { title: 'Pages', items: pages },
      { title: 'Contacts', items: contactResults },
      { title: 'Deals', items: dealResults },
    ].filter((section) => section.items.length > 0)
  }, [contacts, deals, normalizedQuery])

  const flattenedResults = useMemo(() => sections.flatMap((section) => section.items), [sections])

  useEffect(() => {
    if (flattenedResults.length === 0) {
      setHighlightedIndex(0)
      return
    }

    setHighlightedIndex((current) => Math.min(current, flattenedResults.length - 1))
  }, [flattenedResults.length])

  function closePalette() {
    setOpen(false)
    setQuery('')
  }

  function activateItem(item) {
    if (!item) {
      return
    }

    if (item.type === 'page') {
      navigate(item.path)
    } else if (item.type === 'contact') {
      navigate('/contacts')
    } else if (item.type === 'deal') {
      navigate('/deals')
    }

    closePalette()
  }

  function handlePaletteKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault()
      closePalette()
      return
    }

    if (flattenedResults.length === 0) {
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlightedIndex((current) => (current + 1) % flattenedResults.length)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlightedIndex((current) => (current - 1 + flattenedResults.length) % flattenedResults.length)
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      activateItem(flattenedResults[highlightedIndex])
    }
  }

  if (!open) {
    return null
  }

  let resultIndex = -1

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 pt-[20vh]" onClick={closePalette}>
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handlePaletteKeydown}
      >
        <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3">
          <span className="text-sm text-gray-400">⌘</span>
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search pages, contacts, deals..."
            className="flex-1 bg-transparent text-sm text-gray-900 outline-none"
          />
          <kbd className="rounded border border-gray-200 px-1.5 py-0.5 text-xs text-gray-400">esc</kbd>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {loading ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">Loading...</div>
          ) : flattenedResults.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">No results for &quot;{query}&quot;</div>
          ) : (
            sections.map((section) => (
              <div key={section.title}>
                <div className="bg-gray-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{section.title}</div>
                {section.items.map((item) => {
                  resultIndex += 1
                  const isHighlighted = resultIndex === highlightedIndex
                  const rowClass = isHighlighted ? 'bg-blue-50 text-blue-900' : 'text-gray-700 hover:bg-gray-50'

                  return (
                    <button
                      type="button"
                      key={`${item.type}-${item.id || item.path}`}
                      onClick={() => activateItem(item)}
                      className={`flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left text-sm ${rowClass}`}
                    >
                      {item.type === 'page' && (
                        <>
                          <span className={`h-2 w-2 rounded-sm ${item.indicator}`} />
                          <span className="font-medium">{item.label}</span>
                        </>
                      )}

                      {item.type === 'contact' && (
                        <>
                          <span className="font-medium">{item.name || 'Unnamed contact'}</span>
                          <span className="ml-auto text-xs text-gray-400">{item.school_name || '—'}</span>
                        </>
                      )}

                      {item.type === 'deal' && (
                        <>
                          <span className="font-medium">{item.title || 'Untitled deal'}</span>
                          <span className="ml-auto rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{item.stage || 'Prospecting'}</span>
                        </>
                      )}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
