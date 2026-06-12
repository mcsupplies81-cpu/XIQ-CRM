// Research scraper — pulls program-specific facts for email grounding
// HS: MaxPreps | College: school athletics site + sports-reference

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return res.text()
}

function extractText(html, pattern) {
  const match = html.match(pattern)
  return match ? match[1].trim() : null
}

// MaxPreps search to find the school's football page
async function findMaxPrepsUrl(schoolName, state) {
  const query = encodeURIComponent(`${schoolName} ${state} football maxpreps.com`)
  const url = `https://www.maxpreps.com/search/schools.aspx?q=${encodeURIComponent(schoolName + ' ' + state)}`
  try {
    const html = await fetchHtml(url)
    const match = html.match(/href="(\/[^"]+football[^"]+)"/)
    if (match) return `https://www.maxpreps.com${match[1]}`
  } catch {}
  return null
}

async function scrapeMaxPreps(schoolName, state) {
  try {
    const pageUrl = `https://www.maxpreps.com/search/schools.aspx?q=${encodeURIComponent(schoolName + ' ' + state + ' football')}`
    const html = await fetchHtml(pageUrl)

    // Parse record
    const record = extractText(html, /(\d+-\d+(?:-\d+)?)\s*(?:overall|record)/i)

    // Parse ranking
    const ranking = extractText(html, /(?:ranked?|#)\s*(\d+)/i)

    // Parse enrollment
    const enrollment = extractText(html, /enrollment[:\s]+([0-9,]+)/i)

    return {
      source: 'maxpreps',
      schoolName,
      state,
      record: record || null,
      ranking: ranking ? `#${ranking}` : null,
      enrollment: enrollment || null,
      raw: html.slice(0, 2000),
    }
  } catch (err) {
    return { source: 'maxpreps', schoolName, state, error: err.message }
  }
}

// College: pull from school athletics site
async function scrapeCollegeProgram(schoolName, athleticsDomain) {
  try {
    const url = `https://${athleticsDomain}/sports/football`
    const html = await fetchHtml(url)
    const record = extractText(html, /(\d+-\d+(?:-\d+)?)\s*(?:overall|record)/i)
    const season = extractText(html, /(20\d\d)\s*(?:season|football)/i)
    return {
      source: 'athletics-site',
      schoolName,
      domain: athleticsDomain,
      record: record || null,
      season: season || null,
      raw: html.slice(0, 2000),
    }
  } catch (err) {
    return { source: 'athletics-site', schoolName, domain: athleticsDomain, error: err.message }
  }
}

// Main entry — returns a research bundle for a contact
async function getResearch(contact, school) {
  const isCollege = ['FCS', 'FBS', 'D1', 'D2', 'D3', 'NAIA', 'JUCO'].includes(school.level)

  if (isCollege) {
    // Use what we know from the DB + any cached data
    return {
      type: 'college',
      schoolName: school.name,
      state: school.state,
      level: school.level,
      coachName: contact.name,
      role: contact.role,
      // These get enriched manually or from a college DB
      notes: school.notes || '',
    }
  }

  // High school: MaxPreps
  const data = await scrapeMaxPreps(school.name, school.state)
  return {
    type: 'highschool',
    schoolName: school.name,
    state: school.state,
    coachName: contact.name,
    role: contact.role,
    record: data.record,
    ranking: data.ranking,
    enrollment: data.enrollment,
    raw: data.raw || '',
    error: data.error || null,
  }
}

module.exports = { getResearch, scrapeMaxPreps, scrapeCollegeProgram }
