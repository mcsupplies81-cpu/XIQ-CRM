const XLSX = require('xlsx')
const { neon } = require('@neondatabase/serverless')

const sql = neon('postgresql://neondb_owner:npg_R6Je2tiBWwsL@ep-holy-silence-aqj7t929-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require')

const FILES = [
  // OH: use the second file (more emails), supplement with first for any gaps
  {
    path: '/Users/cameron/Downloads/oh_football_top400_contacts_ranks_176_200.xlsx',
    fallback: '/Users/cameron/Downloads/oh_football_top400_contacts.xlsx',
    state: 'OH',
  },
  // TX: use the batch file (190 emails), supplement with main file
  {
    path: "/Users/cameron/Downloads/tx_football_top300_contacts_batch_12_ranks_276_300 (1).xlsx",
    fallback: '/Users/cameron/Downloads/tx_football_top300_contacts.xlsx',
    state: 'TX',
  },
]

function readRows(filePath) {
  const wb = XLSX.readFile(filePath)
  const ws = wb.Sheets[wb.SheetNames[0]]
  return XLSX.utils.sheet_to_json(ws, { defval: '' })
}

function cleanStr(v) {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

function cleanEmail(v) {
  const s = cleanStr(v)
  if (!s) return null
  // take first if multiple separated by ; or ,
  const first = s.split(/[;,]/)[0].trim()
  return first.includes('@') ? first : null
}

function cleanPhone(v) {
  const s = cleanStr(v)
  if (!s) return null
  // Take first phone if there's extra context after a space
  return s.split(/\s+\(/)[0].trim()
}

function cleanXHandle(v) {
  const s = cleanStr(v)
  if (!s) return null
  // Strip URL prefix if present
  const match = s.match(/x\.com\/([^/?#\s]+)/i) || s.match(/twitter\.com\/([^/?#\s]+)/i)
  if (match) return '@' + match[1]
  // If it's already a handle
  if (s.startsWith('@')) return s
  if (!s.includes('/') && !s.includes(' ')) return '@' + s
  return null
}

function parseRow(row) {
  // row[0] = header map row; rows[1+] are data rows
  // __EMPTY = School, __EMPTY_1 = City, __EMPTY_2 = State
  // first key = Rank
  const firstKey = Object.keys(row)[0]
  return {
    rank: Number(row[firstKey]) || null,
    school: cleanStr(row['__EMPTY']),
    city: cleanStr(row['__EMPTY_1']),
    state: cleanStr(row['__EMPTY_2']),
    coachName: cleanStr(row['__EMPTY_5']),
    coachEmail: cleanEmail(row['__EMPTY_6']),
    coachPhone: cleanPhone(row['__EMPTY_7']),
    coachX: cleanXHandle(row['__EMPTY_11']),
    adName: cleanStr(row['__EMPTY_17']),
    adEmail: cleanEmail(row['__EMPTY_18']),
    adPhone: cleanPhone(row['__EMPTY_19']),
    maxprepsUrl: cleanStr(row['__EMPTY_26']),
  }
}

// Merge two arrays of rows by school name — prefer primary, fill gaps from fallback
function mergeRows(primary, fallback) {
  const fallbackMap = new Map()
  fallback.forEach((r) => {
    if (r.school) fallbackMap.set(r.school.toLowerCase(), r)
  })

  return primary.map((pr) => {
    if (!pr.school) return pr
    const fb = fallbackMap.get(pr.school.toLowerCase())
    if (!fb) return pr
    return {
      rank: pr.rank || fb.rank,
      school: pr.school || fb.school,
      city: pr.city || fb.city,
      state: pr.state || fb.state,
      coachName: pr.coachName || fb.coachName,
      coachEmail: pr.coachEmail || fb.coachEmail,
      coachPhone: pr.coachPhone || fb.coachPhone,
      coachX: pr.coachX || fb.coachX,
      adName: pr.adName || fb.adName,
      adEmail: pr.adEmail || fb.adEmail,
      adPhone: pr.adPhone || fb.adPhone,
      maxprepsUrl: pr.maxprepsUrl || fb.maxprepsUrl,
    }
  })
}

async function importFile({ path, fallback, state }) {
  console.log(`\nImporting ${state} from ${path.split('/').pop()}`)

  const primaryRows = readRows(path).slice(1).map(parseRow).filter((r) => r.school)
  const fallbackRows = fallback ? readRows(fallback).slice(1).map(parseRow).filter((r) => r.school) : []
  const rows = fallback ? mergeRows(primaryRows, fallbackRows) : primaryRows

  console.log(`  ${rows.length} schools to import`)

  let schoolsInserted = 0
  let contactsInserted = 0
  let skipped = 0

  for (const row of rows) {
    // Upsert school
    const schoolRows = await sql`
      INSERT INTO schools (name, city, state, level, rank, maxpreps_url)
      VALUES (${row.school}, ${row.city || null}, ${row.state || state}, 'HS', ${row.rank}, ${row.maxprepsUrl})
      ON CONFLICT (name) DO UPDATE SET
        city = COALESCE(EXCLUDED.city, schools.city),
        state = COALESCE(EXCLUDED.state, schools.state),
        level = 'HS',
        rank = COALESCE(EXCLUDED.rank, schools.rank),
        maxpreps_url = COALESCE(EXCLUDED.maxpreps_url, schools.maxpreps_url)
      RETURNING id
    `
    const schoolId = schoolRows[0].id
    schoolsInserted++

    // Insert Head Coach
    if (row.coachName) {
      try {
        const existing = await sql`SELECT id FROM contacts WHERE school_id = ${schoolId} AND role = 'HC' LIMIT 1`
        if (existing.length === 0) {
          await sql`
            INSERT INTO contacts (school_id, name, email, phone, role, status, x_handle)
            VALUES (${schoolId}, ${row.coachName}, ${row.coachEmail}, ${row.coachPhone}, 'HC', 'New', ${row.coachX})
          `
          contactsInserted++
        }
      } catch (e) {
        if (e.message?.includes('duplicate key') || e.message?.includes('unique')) {
          skipped++
        } else {
          console.warn(`  Coach insert error for ${row.school}: ${e.message}`)
        }
      }
    }

    // Insert Athletic Director
    if (row.adName) {
      // Handle multiple ADs (e.g., "Name1 / Name2") — take first
      const adName = row.adName.split('/')[0].trim()
      const adEmail = row.adEmail ? row.adEmail.split(/[;,]/)[0].trim() : null
      if (adName) {
        try {
          const existing = await sql`SELECT id FROM contacts WHERE school_id = ${schoolId} AND role = 'AD' LIMIT 1`
          if (existing.length === 0) {
            await sql`
              INSERT INTO contacts (school_id, name, email, phone, role, status)
              VALUES (${schoolId}, ${adName}, ${adEmail && adEmail.includes('@') ? adEmail : null}, ${row.adPhone}, 'AD', 'New')
            `
            contactsInserted++
          }
        } catch (e) {
          if (e.message?.includes('duplicate key') || e.message?.includes('unique')) {
            skipped++
          } else {
            console.warn(`  AD insert error for ${row.school}: ${e.message}`)
          }
        }
      }
    }
  }

  console.log(`  Schools upserted: ${schoolsInserted}`)
  console.log(`  Contacts inserted: ${contactsInserted}`)
  console.log(`  Skipped (duplicate email): ${skipped}`)
}

async function main() {
  console.log('Starting HS football import...')

  for (const file of FILES) {
    await importFile(file)
  }

  // Summary
  const schoolCount = await sql`SELECT count(*)::int as n FROM schools WHERE level = 'HS'`
  const contactCount = await sql`SELECT count(*)::int as n FROM contacts c JOIN schools s ON c.school_id = s.id WHERE s.level = 'HS'`
  console.log(`\nDone!`)
  console.log(`  HS schools in DB: ${schoolCount[0].n}`)
  console.log(`  HS contacts in DB: ${contactCount[0].n}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
