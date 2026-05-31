import { useEffect, useMemo, useState } from 'react'
import SchoolDetail from './SchoolDetail.jsx'

const activePill = 'rounded border border-gray-900 bg-gray-900 px-2.5 py-1 text-xs font-medium text-white transition-colors'
const inactivePill = 'rounded border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50'

function formatLocation(city, state) {
  return [city, state].filter(Boolean).join(', ') || '—'
}

function toggleValue(values, value) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
}

function uniqueValues(items, key) {
  return Array.from(new Set(items.map((item) => item[key]).filter(Boolean))).sort((a, b) => a.localeCompare(b))
}

function deriveSchools(contacts, deals) {
  const dealCounts = deals.reduce((counts, deal) => {
    if (deal.school_id) {
      counts[deal.school_id] = (counts[deal.school_id] || 0) + 1
    }
    return counts
  }, {})

  const schoolsByKey = new Map()

  contacts.forEach((contact) => {
    const key = contact.school_id || contact.school_name

    if (!key || schoolsByKey.has(key)) {
      return
    }

    schoolsByKey.set(key, {
      id: contact.school_id,
      name: contact.school_name || 'Unknown School',
      city: contact.city || '',
      state: contact.state || '',
      division: contact.division || '—',
      contactsCount: contacts.filter((item) => (contact.school_id ? item.school_id === contact.school_id : item.school_name === contact.school_name)).length,
      dealsCount: dealCounts[contact.school_id] || 0,
    })
  })

  return Array.from(schoolsByKey.values()).sort((a, b) => a.name.localeCompare(b.name))
}

export default function SchoolsView() {
  const [schools, setSchools] = useState([])
  const [selectedSchoolId, setSelectedSchoolId] = useState(null)
  const [search, setSearch] = useState('')
  const [selectedStates, setSelectedStates] = useState([])
  const [selectedDivisions, setSelectedDivisions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function loadSchools() {
      setLoading(true)
      const [contactsResponse, dealsResponse] = await Promise.all([fetch('/api/contacts'), fetch('/api/deals')])
      const contacts = contactsResponse.ok ? await contactsResponse.json() : []
      const deals = dealsResponse.ok ? await dealsResponse.json() : []

      if (active) {
        setSchools(deriveSchools(contacts, deals))
        setLoading(false)
      }
    }

    loadSchools()

    return () => {
      active = false
    }
  }, [])

  const states = useMemo(() => uniqueValues(schools, 'state'), [schools])
  const divisions = useMemo(() => uniqueValues(schools, 'division'), [schools])

  const filteredSchools = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return schools.filter((school) => {
      const matchesSearch =
        !normalizedSearch ||
        school.name.toLowerCase().includes(normalizedSearch) ||
        school.city.toLowerCase().includes(normalizedSearch)
      const matchesState = selectedStates.length === 0 || selectedStates.includes(school.state)
      const matchesDivision = selectedDivisions.length === 0 || selectedDivisions.includes(school.division)

      return matchesSearch && matchesState && matchesDivision
    })
  }, [schools, search, selectedStates, selectedDivisions])

  return (
    <div className="flex min-h-screen bg-gray-50">
      <section className="min-w-0 flex-1 p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-gray-900">Schools</h1>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search schools or cities"
            className="w-80 rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none"
          />
        </div>

        <div className="mb-2 flex flex-wrap gap-2">
          {states.map((state) => (
            <button
              key={state}
              type="button"
              onClick={() => setSelectedStates((current) => toggleValue(current, state))}
              className={selectedStates.includes(state) ? activePill : inactivePill}
            >
              {state}
            </button>
          ))}
          <span className="mx-1 h-6 border-l border-gray-200" />
          {divisions.map((division) => (
            <button
              key={division}
              type="button"
              onClick={() => setSelectedDivisions((current) => toggleValue(current, division))}
              className={selectedDivisions.includes(division) ? activePill : inactivePill}
            >
              {division}
            </button>
          ))}
        </div>
        <p className="mb-4 text-sm text-gray-500">Showing {filteredSchools.length} of {schools.length} schools</p>

        <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
          <table className="min-w-full text-left">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
              <tr className="h-9">
                <th className="px-3 py-2 font-medium">School</th>
                <th className="px-3 py-2 font-medium">Location</th>
                <th className="px-3 py-2 font-medium">Division</th>
                <th className="px-3 py-2 font-medium">Contacts</th>
                <th className="px-3 py-2 font-medium">Deals</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {loading ? (
                <tr className="h-10 border-b border-gray-100">
                  <td colSpan="5" className="px-3 py-2 text-center text-sm text-gray-500">Loading schools...</td>
                </tr>
              ) : filteredSchools.length === 0 ? (
                <tr className="h-10 border-b border-gray-100">
                  <td colSpan="5" className="px-3 py-2 text-center text-sm text-gray-500">No schools found.</td>
                </tr>
              ) : (
                filteredSchools.map((school) => (
                  <tr
                    key={school.id || school.name}
                    onClick={() => school.id && setSelectedSchoolId(school.id)}
                    className={`h-10 cursor-pointer border-b border-gray-100 transition-colors hover:bg-gray-50 ${selectedSchoolId === school.id ? 'bg-blue-50' : ''}`}
                  >
                    <td className="px-3 py-2 text-sm font-medium text-gray-900">{school.name}</td>
                    <td className="px-3 py-2 text-sm text-gray-500">{formatLocation(school.city, school.state)}</td>
                    <td className="px-3 py-2 text-sm text-gray-500">{school.division}</td>
                    <td className="px-3 py-2 text-sm text-gray-900">{school.contactsCount}</td>
                    <td className="px-3 py-2 text-sm text-gray-900">{school.dealsCount}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedSchoolId ? <SchoolDetail schoolId={selectedSchoolId} onClose={() => setSelectedSchoolId(null)} /> : null}
    </div>
  )
}
