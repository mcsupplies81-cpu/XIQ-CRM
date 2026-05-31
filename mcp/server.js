import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { neon } from '@neondatabase/serverless'
import { z } from 'zod'
import { readFileSync } from 'fs'
import { extname } from 'path'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) throw new Error('DATABASE_URL is required')

const sql = neon(DATABASE_URL)

const server = new McpServer({
  name: 'xiq-crm',
  version: '1.0.0',
})

// ─── REPORTING ────────────────────────────────────────────────────────────────

server.tool(
  'get_report',
  'Get a full CRM status report: pipeline health, deals needing attention, follow-ups due, and team activity summary.',
  {},
  async () => {
    const [contacts, deals, todayActivity, followUps] = await Promise.all([
      sql`
        SELECT status, assigned_to, count(*)::int as count
        FROM contacts
        GROUP BY status, assigned_to
        ORDER BY status, assigned_to
      `,
      sql`
        SELECT stage, count(*)::int as count, sum(value)::numeric as total_value
        FROM deals
        GROUP BY stage
        ORDER BY stage
      `,
      sql`
        SELECT type, count(*)::int as count
        FROM activities
        WHERE created_at >= CURRENT_DATE
        GROUP BY type
      `,
      sql`
        SELECT contacts.name, contacts.role, contacts.status, contacts.follow_up_at,
               schools.name as school_name, contacts.assigned_to
        FROM contacts
        LEFT JOIN schools ON contacts.school_id = schools.id
        WHERE contacts.follow_up_at <= CURRENT_DATE
          AND contacts.status != 'Closed'
        ORDER BY contacts.follow_up_at ASC
        LIMIT 20
      `,
    ])

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ contacts_by_status: contacts, deals_by_stage: deals, activity_today: todayActivity, overdue_follow_ups: followUps }, null, 2),
      }],
    }
  },
)

server.tool(
  'query_contacts',
  'Query contacts from the CRM. Filter by status, assigned_to (Email/Calls/DMs), role (HC/AD/OC), or search by name/school.',
  {
    status: z.enum(['New', 'Emailed', 'Called', 'Responded', 'Closed']).optional(),
    assigned_to: z.enum(['Email', 'Calls', 'DMs']).optional(),
    role: z.enum(['HC', 'AD', 'OC']).optional(),
    search: z.string().optional().describe('Search by name or school name'),
    limit: z.number().int().min(1).max(500).default(50),
  },
  async ({ status, assigned_to, role, search, limit }) => {
    const rows = await sql`
      SELECT contacts.id, contacts.name, contacts.role, contacts.email, contacts.phone,
             contacts.x_handle, contacts.status, contacts.assigned_to,
             contacts.notes, contacts.follow_up_at,
             schools.name as school_name, schools.state
      FROM contacts
      LEFT JOIN schools ON contacts.school_id = schools.id
      WHERE
        (${status ?? null} IS NULL OR contacts.status = ${status ?? null})
        AND (${assigned_to ?? null} IS NULL OR contacts.assigned_to = ${assigned_to ?? null})
        AND (${role ?? null} IS NULL OR contacts.role = ${role ?? null})
        AND (${search ?? null} IS NULL OR contacts.name ILIKE ${'%' + (search ?? '') + '%'} OR schools.name ILIKE ${'%' + (search ?? '') + '%'})
      ORDER BY contacts.created_at DESC
      LIMIT ${limit}
    `
    return {
      content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }],
    }
  },
)

server.tool(
  'query_deals',
  'Query deals from the CRM. Filter by stage or search by title/school.',
  {
    stage: z.enum(['Prospecting', 'Qualified', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost']).optional(),
    search: z.string().optional(),
    limit: z.number().int().min(1).max(200).default(50),
  },
  async ({ stage, search, limit }) => {
    const rows = await sql`
      SELECT deals.id, deals.title, deals.stage, deals.value, deals.probability,
             deals.close_date, deals.notes,
             schools.name as school_name, contacts.name as contact_name
      FROM deals
      LEFT JOIN schools ON deals.school_id = schools.id
      LEFT JOIN contacts ON deals.contact_id = contacts.id
      WHERE
        (${stage ?? null} IS NULL OR deals.stage = ${stage ?? null})
        AND (${search ?? null} IS NULL OR deals.title ILIKE ${'%' + (search ?? '') + '%'} OR schools.name ILIKE ${'%' + (search ?? '') + '%'})
      ORDER BY deals.created_at DESC
      LIMIT ${limit}
    `
    return {
      content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }],
    }
  },
)

// ─── IMPORTS ──────────────────────────────────────────────────────────────────

server.tool(
  'import_contacts',
  'Bulk import contacts into the CRM. Each contact can include: name (required), school_name, role (HC/AD/OC), email, phone, x_handle, status, assigned_to, notes. Schools are created automatically if they don\'t exist.',
  {
    contacts: z.array(z.object({
      name: z.string(),
      school_name: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      division: z.string().optional(),
      role: z.enum(['HC', 'AD', 'OC']).optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      x_handle: z.string().optional(),
      status: z.enum(['New', 'Emailed', 'Called', 'Responded', 'Closed']).default('New'),
      assigned_to: z.enum(['Email', 'Calls', 'DMs']).optional(),
      notes: z.string().optional(),
    })),
  },
  async ({ contacts }) => {
    let inserted = 0
    let skipped = 0
    const errors = []

    for (const contact of contacts) {
      try {
        let schoolId = null

        if (contact.school_name) {
          const existing = await sql`
            SELECT id FROM schools WHERE name = ${contact.school_name} LIMIT 1
          `
          if (existing.length > 0) {
            schoolId = existing[0].id
          } else {
            const created = await sql`
              INSERT INTO schools (name, city, state, division)
              VALUES (${contact.school_name}, ${contact.city ?? null}, ${contact.state ?? null}, ${contact.division ?? null})
              ON CONFLICT (name) DO UPDATE SET
                city = COALESCE(EXCLUDED.city, schools.city),
                state = COALESCE(EXCLUDED.state, schools.state),
                division = COALESCE(EXCLUDED.division, schools.division)
              RETURNING id
            `
            schoolId = created[0].id
          }
        }

        await sql`
          INSERT INTO contacts (school_id, name, role, email, phone, x_handle, status, assigned_to, notes)
          VALUES (
            ${schoolId},
            ${contact.name},
            ${contact.role ?? null},
            ${contact.email ?? null},
            ${contact.phone ?? null},
            ${contact.x_handle ?? null},
            ${contact.status ?? 'New'},
            ${contact.assigned_to ?? null},
            ${contact.notes ?? null}
          )
          ON CONFLICT (email) DO NOTHING
        `
        inserted++
      } catch (err) {
        skipped++
        errors.push(`${contact.name}: ${err.message}`)
      }
    }

    return {
      content: [{
        type: 'text',
        text: `Imported ${inserted} contacts. Skipped ${skipped}${errors.length ? '\nErrors:\n' + errors.join('\n') : ''}`,
      }],
    }
  },
)

server.tool(
  'import_deals',
  'Bulk import deals into the CRM.',
  {
    deals: z.array(z.object({
      title: z.string(),
      school_name: z.string().optional(),
      contact_name: z.string().optional(),
      value: z.number().optional(),
      stage: z.enum(['Prospecting', 'Qualified', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost']).default('Prospecting'),
      probability: z.number().int().min(0).max(100).optional(),
      close_date: z.string().optional().describe('ISO date string YYYY-MM-DD'),
      notes: z.string().optional(),
    })),
  },
  async ({ deals }) => {
    let inserted = 0
    let skipped = 0

    for (const deal of deals) {
      try {
        let schoolId = null
        let contactId = null

        if (deal.school_name) {
          const school = await sql`SELECT id FROM schools WHERE name ILIKE ${deal.school_name} LIMIT 1`
          schoolId = school[0]?.id ?? null
        }
        if (deal.contact_name) {
          const contact = await sql`SELECT id FROM contacts WHERE name ILIKE ${deal.contact_name} LIMIT 1`
          contactId = contact[0]?.id ?? null
        }

        await sql`
          INSERT INTO deals (school_id, contact_id, title, value, stage, probability, close_date, notes)
          VALUES (${schoolId}, ${contactId}, ${deal.title}, ${deal.value ?? null}, ${deal.stage}, ${deal.probability ?? 50}, ${deal.close_date ?? null}, ${deal.notes ?? ''})
        `
        inserted++
      } catch (err) {
        skipped++
      }
    }

    return {
      content: [{ type: 'text', text: `Imported ${inserted} deals. Skipped ${skipped}.` }],
    }
  },
)

// ─── UPDATES ──────────────────────────────────────────────────────────────────

server.tool(
  'update_contacts',
  'Update one or more contacts. Pass a list of IDs and the fields to change. Use query_contacts first to find the IDs.',
  {
    ids: z.array(z.string()).describe('Contact IDs to update'),
    status: z.enum(['New', 'Emailed', 'Called', 'Responded', 'Closed']).optional(),
    assigned_to: z.enum(['Email', 'Calls', 'DMs']).optional(),
    follow_up_at: z.string().optional().describe('ISO date YYYY-MM-DD, or empty string to clear'),
    notes: z.string().optional().describe('Replaces existing notes — only use when updating a single contact'),
  },
  async ({ ids, status, assigned_to, follow_up_at, notes }) => {
    if (ids.length === 0) return { content: [{ type: 'text', text: 'No IDs provided.' }] }

    const updated = await sql`
      UPDATE contacts SET
        status = CASE WHEN ${status ?? null} IS NOT NULL THEN ${status ?? null} ELSE status END,
        assigned_to = CASE WHEN ${assigned_to ?? null} IS NOT NULL THEN ${assigned_to ?? null} ELSE assigned_to END,
        follow_up_at = CASE WHEN ${follow_up_at !== undefined} THEN ${follow_up_at || null} ELSE follow_up_at END,
        notes = CASE WHEN ${notes ?? null} IS NOT NULL THEN ${notes ?? null} ELSE notes END,
        updated_at = now()
      WHERE id = ANY(${ids}::uuid[])
      RETURNING id, name, status, assigned_to
    `

    return {
      content: [{ type: 'text', text: `Updated ${updated.length} contacts:\n${updated.map((c) => `  ${c.name} → status:${c.status} assigned:${c.assigned_to}`).join('\n')}` }],
    }
  },
)

server.tool(
  'log_activity',
  'Log a call, email, or DM activity for a contact.',
  {
    contact_id: z.string(),
    type: z.enum(['call', 'email', 'dm']),
    notes: z.string().default(''),
  },
  async ({ contact_id, type, notes }) => {
    const row = await sql`
      INSERT INTO activities (contact_id, type, notes)
      VALUES (${contact_id}, ${type}, ${notes})
      RETURNING id, created_at
    `
    return {
      content: [{ type: 'text', text: `Logged ${type} activity (id: ${row[0].id})` }],
    }
  },
)

server.tool(
  'add_note_to_contact',
  'Append a note to a contact by name or ID. Looks up by name if ID not provided.',
  {
    name_or_id: z.string().describe('Contact name (partial match ok) or UUID'),
    note: z.string(),
  },
  async ({ name_or_id, note }) => {
    const isUuid = /^[0-9a-f-]{36}$/i.test(name_or_id)

    const contacts = isUuid
      ? await sql`SELECT id, name, notes FROM contacts WHERE id = ${name_or_id}`
      : await sql`SELECT id, name, notes FROM contacts WHERE name ILIKE ${'%' + name_or_id + '%'} LIMIT 5`

    if (contacts.length === 0) return { content: [{ type: 'text', text: `No contact found matching "${name_or_id}"` }] }
    if (contacts.length > 1) return { content: [{ type: 'text', text: `Multiple matches: ${contacts.map((c) => c.name).join(', ')} — be more specific or use the ID` }] }

    const contact = contacts[0]
    const updatedNotes = [contact.notes, note].filter(Boolean).join('\n\n')

    await sql`UPDATE contacts SET notes = ${updatedNotes}, updated_at = now() WHERE id = ${contact.id}`

    return {
      content: [{ type: 'text', text: `Added note to ${contact.name}` }],
    }
  },
)

// ─── START ────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport()
await server.connect(transport)
