const XLSX = require('xlsx')
const { neon } = require('@neondatabase/serverless')

const sql = neon('postgresql://neondb_owner:npg_R6Je2tiBWwsL@ep-holy-silence-aqj7t929-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require')

const DIR = '/Users/cameron/Downloads/hsfiles/contacts/'

// ── helpers ──────────────────────────────────────────────────────────────────

function cleanStr(v) {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

function cleanEmail(v) {
  const s = cleanStr(v)
  if (!s) return null
  const first = s.split(/[;,]/)[0].trim()
  return first.includes('@') ? first.toLowerCase() : null
}

function cleanPhone(v) {
  const s = cleanStr(v)
  if (!s) return null
  // Strip trailing context like "(972) 749-2450 (Dallas ISD Athletics)" → keep just the number part
  return s.split(/\s{2,}|\s+(?:\((?![\d]))/)[0].trim()
}

function cleanXHandle(v) {
  const s = cleanStr(v)
  if (!s) return null
  const match = s.match(/(?:x|twitter)\.com\/([^/?#\s]+)/i)
  if (match) return '@' + match[1]
  if (s.startsWith('@')) return s
  if (!s.includes('/') && !s.includes(' ') && !s.includes('.')) return '@' + s
  return null
}

// ── parsers ───────────────────────────────────────────────────────────────────

// Merged-header format (OH / TX / NV): row 0 is the column-name map
function parseMergedRow(row) {
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

// Proper-header format (CA): actual column names on first row, data starts row 0
function parseCaRow(row) {
  const adRaw = cleanStr(row['Athletic Director / Athletics Lead'])
  const adName = adRaw ? adRaw.split('/')[0].trim() : null
  return {
    rank: Number(row['Rank']) || null,
    school: cleanStr(row['School']),
    city: cleanStr(row['City']),
    state: cleanStr(row['State']) || 'CA',
    coachName: cleanStr(row['Head Coach']),
    coachEmail: cleanEmail(row['Coach Email']),
    coachPhone: cleanPhone(row['Coach Phone']),
    coachX: cleanXHandle(row['Coach X']),
    adName,
    adEmail: cleanEmail(row['AD Email']),
    adPhone: cleanPhone(row['AD Phone']),
    maxprepsUrl: cleanStr(row['MaxPreps URL']),
  }
}

function readMergedFile(filePath) {
  const wb = XLSX.readFile(filePath)
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
  return rows.slice(1).map(parseMergedRow).filter((r) => r.school)
}

function readCaFile(filePath) {
  const wb = XLSX.readFile(filePath)
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
  return rows.map(parseCaRow).filter((r) => r.school)
}

// ── upsert logic ─────────────────────────────────────────────────────────────

async function upsertSchool(row, level, fallbackState) {
  const schoolRows = await sql`
    INSERT INTO schools (name, city, state, level, rank, maxpreps_url)
    VALUES (${row.school}, ${row.city}, ${row.state || fallbackState}, ${level}, ${row.rank}, ${row.maxprepsUrl})
    ON CONFLICT (name) DO UPDATE SET
      city         = COALESCE(EXCLUDED.city, schools.city),
      state        = COALESCE(EXCLUDED.state, schools.state),
      level        = ${level},
      rank         = COALESCE(EXCLUDED.rank, schools.rank),
      maxpreps_url = COALESCE(EXCLUDED.maxpreps_url, schools.maxpreps_url)
    RETURNING id
  `
  return schoolRows[0].id
}

// Insert or fill-in-gaps for a contact
async function upsertContact(schoolId, name, email, phone, role, xHandle) {
  if (!name) return 'skipped'

  // Check if this role already exists at this school
  const existing = await sql`
    SELECT id, email, phone, x_handle FROM contacts
    WHERE school_id = ${schoolId} AND role = ${role}
    LIMIT 1
  `

  if (existing.length > 0) {
    // Update only missing fields
    const row = existing[0]
    const updates = {}
    if (!row.email && email) updates.email = email
    if (!row.phone && phone) updates.phone = phone
    if (!row.x_handle && xHandle) updates.x_handle = xHandle

    if (Object.keys(updates).length > 0) {
      await sql`
        UPDATE contacts SET
          email   = COALESCE(${updates.email ?? null}, email),
          phone   = COALESCE(${updates.phone ?? null}, phone),
          x_handle = COALESCE(${updates.x_handle ?? null}, x_handle)
        WHERE id = ${row.id}
      `
      return 'updated'
    }
    return 'unchanged'
  }

  // Insert new contact — skip on duplicate email
  try {
    await sql`
      INSERT INTO contacts (school_id, name, email, phone, role, status, x_handle)
      VALUES (${schoolId}, ${name}, ${email}, ${phone}, ${role}, 'New', ${xHandle})
    `
    return 'inserted'
  } catch (e) {
    if (e.message?.includes('duplicate key') || e.message?.includes('unique')) return 'dup'
    throw e
  }
}

// ── import a file ─────────────────────────────────────────────────────────────

async function importRows(rows, label, fallbackState) {
  let schools = 0, inserted = 0, updated = 0, unchanged = 0, dups = 0

  for (const row of rows) {
    const schoolId = await upsertSchool(row, 'HS', fallbackState)
    schools++

    const coachResult = await upsertContact(schoolId, row.coachName, row.coachEmail, row.coachPhone, 'HC', row.coachX)
    const adName = row.adName ? row.adName.split('/')[0].trim() : null
    const adResult = await upsertContact(schoolId, adName, row.adEmail, row.adPhone, 'AD', null)

    for (const r of [coachResult, adResult]) {
      if (r === 'inserted') inserted++
      else if (r === 'updated') updated++
      else if (r === 'unchanged') unchanged++
      else if (r === 'dup') dups++
    }
  }

  console.log(`  ${label}: ${schools} schools | +${inserted} contacts | ~${updated} updated | ${unchanged} unchanged | ${dups} dup emails skipped`)
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Starting NV + CA import and OH update...\n')

  // NV — merged format, all 79 schools
  const nvRows = readMergedFile(DIR + 'nv_football_all79_contacts_batch_03_ranks_051_075.xlsx')
  console.log(`NV: ${nvRows.length} schools found`)
  await importRows(nvRows, 'NV', 'NV')

  // CA — proper-header format
  const caRows = readCaFile(DIR + 'xiq_ca_football_top200_combined_contacts.xlsx')
  console.log(`\nCA: ${caRows.length} schools found`)
  await importRows(caRows, 'CA', 'CA')

  // OH — updated file with more emails; fill gaps in existing contacts
  const ohRows = readMergedFile(DIR + 'oh_football_top400_contacts_ranks_376_400_completed.xlsx')
  console.log(`\nOH update: ${ohRows.length} schools found`)
  await importRows(ohRows, 'OH', 'OH')

  // Final tally
  const byState = await sql`
    SELECT s.state, count(distinct s.id)::int as schools, count(c.id)::int as contacts
    FROM schools s
    LEFT JOIN contacts c ON c.school_id = s.id
    WHERE s.level = 'HS'
    GROUP BY s.state
    ORDER BY s.state
  `

  console.log('\nHS data by state:')
  byState.forEach((r) => console.log(`  ${r.state}: ${r.schools} schools, ${r.contacts} contacts`))

  const totals = await sql`
    SELECT count(distinct s.id)::int as schools, count(c.id)::int as contacts
    FROM schools s
    LEFT JOIN contacts c ON c.school_id = s.id
    WHERE s.level = 'HS'
  `
  console.log(`\nTotal: ${totals[0].schools} HS schools, ${totals[0].contacts} contacts`)
}

main().catch((e) => { console.error(e); process.exit(1) })
