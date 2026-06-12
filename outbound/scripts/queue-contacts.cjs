// Queue contacts from CRM into outbound sequences
// Usage: node queue-contacts.cjs --campaign hs-football-2026 --state CA --role AD
// or:    node queue-contacts.cjs --campaign college-football-2026 --level FCS

require('dotenv').config()
const { sql } = require('../lib/db.cjs')

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => a.slice(2).split('='))
    .map(([k, v]) => [k, v || true])
)

// Also parse --key value style
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--') && !process.argv[i].includes('=') && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) {
    args[process.argv[i].slice(2)] = process.argv[i + 1]
    i++
  }
}

const CAMPAIGN = args.campaign
const STATE = args.state
const ROLE = args.role
const LEVEL = args.level
const DRY_RUN = args['dry-run'] !== undefined

if (!CAMPAIGN) {
  console.error('Usage: node queue-contacts.cjs --campaign <name> [--state CA] [--role AD|HC] [--level FCS|HS] [--dry-run]')
  process.exit(1)
}

async function main() {
  console.log(`Campaign: ${CAMPAIGN}`)
  if (STATE) console.log(`State filter: ${STATE}`)
  if (ROLE) console.log(`Role filter: ${ROLE}`)
  if (LEVEL) console.log(`Level filter: ${LEVEL}`)
  if (DRY_RUN) console.log('DRY RUN — no DB writes\n')

  // Find eligible contacts
  const contacts = await sql`
    SELECT c.id, c.name, c.email, c.role, c.email_status,
           s.name as school_name, s.state, s.level
    FROM contacts c
    JOIN schools s ON s.id = c.school_id
    WHERE c.email IS NOT NULL
      AND c.email_status IN ('valid', 'accept_all')
      AND (${STATE ?? null}::text IS NULL OR s.state = ${STATE ?? null})
      AND (${ROLE ?? null}::text IS NULL OR c.role = ${ROLE ?? null})
      AND (${LEVEL ?? null}::text IS NULL OR s.level = ${LEVEL ?? null})
      AND NOT EXISTS (
        SELECT 1 FROM outbound_sequences os WHERE os.contact_id = c.id AND os.campaign = ${CAMPAIGN}
      )
      AND NOT EXISTS (
        SELECT 1 FROM unsubscribes u WHERE u.email = c.email
      )
    ORDER BY s.state, s.name
  `

  console.log(`Eligible contacts: ${contacts.length}`)

  if (DRY_RUN) {
    contacts.slice(0, 10).forEach(c => console.log(`  ${c.name} (${c.role}) — ${c.school_name}, ${c.state} — ${c.email}`))
    if (contacts.length > 10) console.log(`  ... and ${contacts.length - 10} more`)
    return
  }

  let queued = 0
  for (const c of contacts) {
    const sendAt = new Date()
    // Stagger initial sends over the day to avoid burst
    sendAt.setMinutes(sendAt.getMinutes() + Math.floor(Math.random() * 60))
    await sql`
      INSERT INTO outbound_sequences (contact_id, campaign, step, status, next_send_at)
      VALUES (${c.id}, ${CAMPAIGN}, 0, 'queued', ${sendAt.toISOString()})
      ON CONFLICT DO NOTHING
    `
    queued++
  }

  console.log(`\nQueued: ${queued} contacts into campaign "${CAMPAIGN}"`)
  console.log('Run send-daily.cjs to start sending.')
}

main().catch(e => { console.error(e); process.exit(1) })
