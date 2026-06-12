// Research engine — Brave Search + Claude Haiku extraction
// Searches for school-specific football facts, extracts structured data

const Anthropic = require('@anthropic-ai/sdk')
const client = new Anthropic.default()

async function braveSearch(query) {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5&search_lang=en&country=us`
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': process.env.BRAVE_SEARCH_API_KEY,
    },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`Brave Search HTTP ${res.status}`)
  const data = await res.json()
  return (data.web?.results || [])
    .map(r => `${r.title}\n${(r.description || '').replace(/<[^>]+>/g, '')}`)
    .join('\n\n')
}

async function extractResearch(snippets, schoolName, state, role) {
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: `You are extracting football program facts from search snippets for a sales email.

School: ${schoolName}, ${state}
Contact role: ${role}

Search snippets:
${snippets}

Extract only facts that are clearly stated in the snippets above. Return a JSON object with these fields (use null if not found):
- record: win-loss record e.g. "11-2" (most recent season)
- stateRank: state ranking e.g. "#3 in Texas"
- notableWin: one specific notable win or opponent e.g. "beat Southlake Carroll 42-28"
- offensiveStyle: brief description e.g. "spread offense", "run-heavy Wing-T"
- stateFact: state championship or playoff info e.g. "2024 6A-DII state champs", "5 straight playoff appearances"
- enrollment: student enrollment number if mentioned

Return ONLY the JSON object, no other text.`,
    }],
  })
  try {
    const raw = msg.content[0].text.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

async function getResearch(contact, school) {
  const isCollege = school.level && !['HS', null].includes(school.level) &&
    ['FCS', 'FBS', 'D1', 'D2', 'D3', 'NAIA', 'JUCO'].includes(school.level)

  if (isCollege) {
    return {
      type: 'college',
      schoolName: school.name,
      state: school.state,
      level: school.level,
      coachName: contact.name,
      role: contact.role,
      notes: school.notes || '',
    }
  }

  // High school: search + extract
  try {
    const query = `"${school.name}" ${school.state} high school football 2024 2025 season record`
    const snippets = await braveSearch(query)

    if (!snippets || snippets.length < 50) {
      return { type: 'highschool', schoolName: school.name, state: school.state, coachName: contact.name, role: contact.role }
    }

    const facts = await extractResearch(snippets, school.name, school.state, contact.role)

    return {
      type: 'highschool',
      schoolName: school.name,
      state: school.state,
      coachName: contact.name,
      role: contact.role,
      record: facts.record || null,
      stateRank: facts.stateRank || null,
      notableWin: facts.notableWin || null,
      offensiveStyle: facts.offensiveStyle || null,
      stateFact: facts.stateFact || null,
      enrollment: facts.enrollment || null,
      notes: school.notes || null,
    }
  } catch (err) {
    return {
      type: 'highschool',
      schoolName: school.name,
      state: school.state,
      coachName: contact.name,
      role: contact.role,
    }
  }
}

module.exports = { getResearch }
