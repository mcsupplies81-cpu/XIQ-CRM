// Sync enriched Deepline data back into the CRM
// - Sets cell_phone on HC contacts where found
// - Sets email_status on HC + AD contacts
// - Clears email (sets NULL) where status is 'invalid'
// - Skips contacts that already have a cell_phone (won't overwrite)

const XLSX = require('xlsx')
const { neon } = require('@neondatabase/serverless')

const sql = neon('postgresql://neondb_owner:npg_R6Je2tiBWwsL@ep-holy-silence-aqj7t929-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require')

// ── Clean Excel files produced by Deepline enrichment ──────────────────────
const FILES = [
  {
    path: '/Users/cameron/Downloads/hsfiles/contacts/xiq_ca_football_clean.xlsx',
    label: 'CA',
  },
  {
    path: '/Users/cameron/Downloads/hsfiles/contacts/xiq_tx_football_clean.xlsx',
    label: 'TX',
  },
]

// ── Helpers ────────────────────────────────────────────────────────────────

function cleanStr(v) {
  if (!v && v !== 0) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

function cleanPhone(v) {
  if (!v && v !== 0) return null
  // Handle numeric values from Excel (e.g. 16787542415 → +16787542415)
  const digits = String(v).replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits
  if (digits.length === 10) return '+1' + digits
  // Handle already-formatted E.164 strings
  const s = String(v).trim()
  if (s.startsWith('+') && digits.length >= 10) return s
  return null
}

function cleanStatus(v) {
  const s = cleanStr(v)
  if (!s) return null
  // Normalize 'accept-all' → 'accept_all'
  if (s === 'accept-all') return 'accept_all'
  if (['valid', 'accept_all', 'invalid', 'unknown'].includes(s)) return s
  return null
}

function cleanEmail(v) {
  const s = cleanStr(v)
  if (!s || !s.includes('@')) return null
  return s.toLowerCase()
}

function readFile(filePath) {
  const wb = XLSX.readFile(filePath)
  const ws = wb.Sheets[wb.SheetNames[0]]
  return XLSX.utils.sheet_to_json(ws, { defval: '' })
}

// ── DB helpers ─────────────────────────────────────────────────────────────

async function getSchoolId(schoolName) {
  const rows = await sql`
    SELECT id FROM schools WHERE LOWER(name) = LOWER(${schoolName}) LIMIT 1
  `
  return rows[0]?.id ?? null
}

async function syncCoach(schoolId, coachName, cellPhone, coachEmail, emailStatus) {
  // Find HC at this school
  const contacts = await sql`
    SELECT id, email, cell_phone FROM contacts
    WHERE school_id = ${schoolId} AND role = 'HC'
    LIMIT 1
  `
  if (!contacts.length) return 'not_found'

  const contact = contacts[0]
  const updates = {}

  // Set cell_phone only if not already set
  if (cellPhone && !contact.cell_phone) {
    updates.cell_phone = cellPhone
  }

  // Set email_status
  if (emailStatus) {
    updates.email_status = emailStatus
  }

  // Clear email if invalid
  if (emailStatus === 'invalid' && contact.email) {
    updates.email = null
  }

  if (Object.keys(updates).length === 0) return 'unchanged'

  // Update cell_phone and email_status (never overwrite existing email)
  await sql`
    UPDATE contacts SET
      cell_phone   = COALESCE(${updates.cell_phone   ?? null}, cell_phone),
      email_status = COALESCE(${updates.email_status ?? null}, email_status)
    WHERE id = ${contact.id}
  `

  // Only clear email if explicitly invalid
  if (updates.email === null) {
    await sql`UPDATE contacts SET email = NULL WHERE id = ${contact.id}`
  }

  return Object.keys(updates).join('+')
}

async function syncAD(schoolId, adEmail, emailStatus) {
  const contacts = await sql`
    SELECT id, email FROM contacts
    WHERE school_id = ${schoolId} AND role = 'AD'
    LIMIT 1
  `
  if (!contacts.length) return 'not_found'

  const contact = contacts[0]
  const updates = {}

  if (emailStatus) updates.email_status = emailStatus
  if (emailStatus === 'invalid' && contact.email) updates.email = null

  if (Object.keys(updates).length === 0) return 'unchanged'

  await sql`UPDATE contacts SET email_status = ${updates.email_status ?? null} WHERE id = ${contact.id}`
  if (updates.email === null) {
    await sql`UPDATE contacts SET email = NULL WHERE id = ${contact.id}`
  }

  return Object.keys(updates).join('+')
}

// ── Process a file ─────────────────────────────────────────────────────────

async function processFile({ path, label }) {
  const rows = readFile(path)
  console.log(`\n${label}: ${rows.length} rows`)

  let schoolMiss = 0, coachUpdated = 0, coachUnchanged = 0, coachMiss = 0
  let adUpdated = 0, adUnchanged = 0, adMiss = 0
  let cellsAdded = 0, emailsCleared = 0

  for (const row of rows) {
    const schoolName = cleanStr(row['School'])
    if (!schoolName) continue

    const schoolId = await getSchoolId(schoolName)
    if (!schoolId) { schoolMiss++; continue }

    const cellPhone    = cleanPhone(row['Cell Phone'])
    const coachEmail   = cleanEmail(row['Coach Email'])
    const coachStatus  = cleanStatus(row['Coach Email Status'] || row['Status'])
    const adEmail      = cleanEmail(row['AD Email'])
    const adStatus     = cleanStatus(row['AD Email Status'] || row['Status_1'] || row['Status__1'])

    // Sync coach
    const coachResult = await syncCoach(schoolId, cleanStr(row['Head Coach']), cellPhone, coachEmail, coachStatus)
    if (coachResult === 'not_found') coachMiss++
    else if (coachResult === 'unchanged') coachUnchanged++
    else {
      coachUpdated++
      if (coachResult.includes('cell_phone')) cellsAdded++
      if (coachResult.includes('email') && coachStatus === 'invalid') emailsCleared++
    }

    // Sync AD
    const adResult = await syncAD(schoolId, adEmail, adStatus)
    if (adResult === 'not_found') adMiss++
    else if (adResult === 'unchanged') adUnchanged++
    else adUpdated++
  }

  console.log(`  Schools not found in DB : ${schoolMiss}`)
  console.log(`  Coaches updated         : ${coachUpdated} (cells added: ${cellsAdded}, bad emails cleared: ${emailsCleared})`)
  console.log(`  Coaches unchanged       : ${coachUnchanged}`)
  console.log(`  Coaches not in DB       : ${coachMiss}`)
  console.log(`  ADs updated             : ${adUpdated}`)
  console.log(`  ADs unchanged           : ${adUnchanged}`)
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('Syncing Deepline enrichment data into CRM...')

  for (const file of FILES) {
    await processFile(file)
  }

  // Summary from DB
  const summary = await sql`
    SELECT
      s.state,
      COUNT(DISTINCT CASE WHEN c.role = 'HC' AND c.cell_phone IS NOT NULL THEN c.id END) AS hc_with_cell,
      COUNT(DISTINCT CASE WHEN c.role = 'HC' AND c.email_status = 'valid' THEN c.id END) AS hc_email_valid,
      COUNT(DISTINCT CASE WHEN c.role = 'HC' AND c.email_status = 'accept_all' THEN c.id END) AS hc_email_accept,
      COUNT(DISTINCT CASE WHEN c.role = 'AD' AND c.email_status = 'valid' THEN c.id END) AS ad_email_valid
    FROM schools s
    JOIN contacts c ON c.school_id = s.id
    WHERE s.state IN ('CA', 'TX')
    GROUP BY s.state
    ORDER BY s.state
  `

  console.log('\n── CRM summary (CA + TX) ──')
  summary.forEach(r => {
    console.log(`  ${r.state}: ${r.hc_with_cell} HC cells | ${r.hc_email_valid} HC valid emails | ${r.hc_email_accept} HC accept-all | ${r.ad_email_valid} AD valid emails`)
  })

  console.log('\nDone.')
}

main().catch(e => { console.error(e); process.exit(1) })
