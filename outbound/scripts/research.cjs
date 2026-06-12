// Research engine — Brave Search + Claude Haiku extraction
// 2 parallel searches per contact: program performance + coach background

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

async function extractResearch(snippets, schoolName, state, coachName, role) {
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `Extract football program and coach facts from these search snippets for a personalized sales email.

School: ${schoolName}, ${state}
Coach: ${coachName} (${role})

Search snippets:
${snippets}

Return ONLY a JSON object. Use null for anything not clearly stated in the snippets — do NOT invent or guess.

Fields:
- record: most recent win-loss record e.g. "14-1"
- stateRank: state or national ranking e.g. "#3 in Texas", "#1 in nation"
- notableWin: one specific notable win with opponent and score if available e.g. "beat Southlake Carroll 42-28 in the playoffs"
- stateFact: state championship or playoff achievement e.g. "2024 6A-DII state champs", "12 state titles", "5 straight playoff appearances"
- offensiveStyle: how they run their offense e.g. "spread RPO", "run-heavy Wing-T", "air raid", "pro-style"
- enrollment: student enrollment if mentioned
- coachTenure: how long this coach has been at this school e.g. "entering his 8th season", "hired in 2019"
- coachBackground: where the coach came from or prior notable role e.g. "former OC at Baylor", "played at TCU", "came from Katy High School"
- programHistory: notable program history beyond current season e.g. "6 state titles since 2009", "only program in Texas with back-to-back 6A titles"
- conference: district or conference name e.g. "District 5-6A", "Big 12 Conference"

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
  const isCollege = ['FCS', 'FBS', 'D1', 'D2', 'D3', 'NAIA', 'JUCO'].includes(school.level)
  const level = isCollege ? 'college' : 'highschool'

  try {
    // Two parallel searches: program performance + coach background
    const [programSnippets, coachSnippets] = await Promise.allSettled([
      braveSearch(`"${school.name}" ${school.state} ${isCollege ? 'college' : 'high school'} football 2024 2025 season`),
      braveSearch(`"${contact.name}" "${school.name}" football coach`),
    ])

    const combined = [
      programSnippets.status === 'fulfilled' ? programSnippets.value : '',
      coachSnippets.status === 'fulfilled' ? coachSnippets.value : '',
    ].filter(s => s.length > 30).join('\n\n---\n\n')

    if (!combined || combined.length < 50) {
      return { type: level, schoolName: school.name, state: school.state, coachName: contact.name, role: contact.role }
    }

    const facts = await extractResearch(combined, school.name, school.state, contact.name, contact.role)

    return {
      type: level,
      schoolName: school.name,
      state: school.state,
      level: school.level,
      coachName: contact.name,
      role: contact.role,
      record: facts.record || null,
      stateRank: facts.stateRank || null,
      notableWin: facts.notableWin || null,
      stateFact: facts.stateFact || null,
      offensiveStyle: facts.offensiveStyle || null,
      enrollment: facts.enrollment || null,
      coachTenure: facts.coachTenure || null,
      coachBackground: facts.coachBackground || null,
      programHistory: facts.programHistory || null,
      conference: facts.conference || null,
      notes: school.notes || null,
    }
  } catch (err) {
    return {
      type: level,
      schoolName: school.name,
      state: school.state,
      coachName: contact.name,
      role: contact.role,
    }
  }
}

module.exports = { getResearch }
