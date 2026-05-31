import Anthropic from '@anthropic-ai/sdk'
import { getUserId } from './_auth.js'
import { sql } from './db.js'

// Requires ANTHROPIC_API_KEY in environment (Vercel dashboard + .env.local for dev)
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const MODEL = 'claude-haiku-4-5-20251001'
const MAX_TOOL_ROUNDS = 5
const CONTACT_STATUSES = ['New', 'Emailed', 'Called', 'Responded', 'Closed']
const ASSIGNEES = ['Email', 'Calls', 'DMs']
const ROLES = ['HC', 'AD', 'OC']

const systemPrompt =
  'You are an AI assistant built into XIQ CRM, a sales CRM for sports outreach. You help the team manage contacts (coaches, ADs), deals, and activities. The team has three members: Cameron (deals/email), Malcolm (calls), and Garrett (X DMs). You can read and update data in the CRM using the tools provided. Be concise. When you run a query, summarize the results clearly. When you make updates, confirm what changed.'

const tools = [
  {
    name: 'get_contacts',
    description: 'Get contacts from the CRM. Can filter by status, assigned_to, role, or search by name/school.',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: CONTACT_STATUSES },
        assigned_to: { type: 'string', enum: ASSIGNEES },
        role: { type: 'string', enum: ROLES },
        search: { type: 'string', description: 'search name or school name' },
        limit: { type: 'number', default: 20 },
      },
    },
  },
  {
    name: 'update_contact',
    description: "Update a contact's status, assigned_to, notes, or follow_up_at.",
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        status: { type: 'string', enum: CONTACT_STATUSES },
        assigned_to: { type: 'string', enum: ASSIGNEES },
        notes: { type: 'string' },
        follow_up_at: { type: 'string', description: 'ISO date' },
      },
      required: ['id'],
    },
  },
  {
    name: 'get_deals',
    description: 'Get deals from the CRM. Can filter by stage.',
    input_schema: {
      type: 'object',
      properties: {
        stage: { type: 'string' },
        limit: { type: 'number', default: 20 },
      },
    },
  },
  {
    name: 'get_stats',
    description: 'Get CRM summary stats: contact counts by status, deal counts by stage, activity count today.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'bulk_update_contacts',
    description: 'Update multiple contacts at once. Use after get_contacts to act on a filtered list.',
    input_schema: {
      type: 'object',
      properties: {
        ids: { type: 'array', items: { type: 'string' } },
        status: { type: 'string', enum: CONTACT_STATUSES },
        assigned_to: { type: 'string', enum: ASSIGNEES },
        follow_up_at: { type: 'string' },
      },
      required: ['ids'],
    },
  },
]

async function readBody(req) {
  if (typeof req.body === 'string') {
    return req.body ? JSON.parse(req.body) : {}
  }

  if (req.body) {
    return req.body
  }

  const chunks = []
  for await (const chunk of req) {
    chunks.push(chunk)
  }

  const body = Buffer.concat(chunks).toString('utf8')
  return body ? JSON.parse(body) : {}
}

function normalizeLimit(limit) {
  const parsed = Number(limit) || 20
  return Math.min(Math.max(Math.trunc(parsed), 1), 50)
}

function requireEnum(value, allowedValues, fieldName) {
  if (value && !allowedValues.includes(value)) {
    throw new Error(`${fieldName} must be one of: ${allowedValues.join(', ')}`)
  }
}

function buildSetClause(input, allowedFields) {
  const setClauses = []
  const values = []

  allowedFields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(input, field)) {
      values.push(input[field] || null)
      setClauses.push(`${field} = $${values.length}`)
    }
  })

  if (setClauses.length === 0) {
    throw new Error(`At least one field is required: ${allowedFields.join(', ')}`)
  }

  setClauses.push('updated_at = NOW()')
  return { setClause: setClauses.join(', '), values }
}

async function getContacts(input = {}) {
  const { status, assigned_to, role, search } = input
  const limit = normalizeLimit(input.limit)

  requireEnum(status, CONTACT_STATUSES, 'status')
  requireEnum(assigned_to, ASSIGNEES, 'assigned_to')
  requireEnum(role, ROLES, 'role')

  const whereClauses = []
  const values = []

  if (status) {
    values.push(status)
    whereClauses.push(`contacts.status = $${values.length}`)
  }

  if (assigned_to) {
    values.push(assigned_to)
    whereClauses.push(`contacts.assigned_to = $${values.length}`)
  }

  if (role) {
    values.push(role)
    whereClauses.push(`contacts.role = $${values.length}`)
  }

  if (search) {
    values.push(`%${search}%`)
    whereClauses.push(`(contacts.name ILIKE $${values.length} OR schools.name ILIKE $${values.length})`)
  }

  values.push(limit)
  const limitPlaceholder = `$${values.length}`
  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : ''

  return sql(
    `SELECT contacts.*, schools.name as school_name, schools.state
     FROM contacts
     LEFT JOIN schools ON contacts.school_id = schools.id
     ${whereSql}
     ORDER BY contacts.created_at DESC
     LIMIT ${limitPlaceholder}`,
    values,
  )
}

async function updateContact(input = {}) {
  const { id, status, assigned_to } = input

  if (!id) {
    throw new Error('id is required')
  }

  requireEnum(status, CONTACT_STATUSES, 'status')
  requireEnum(assigned_to, ASSIGNEES, 'assigned_to')

  const { setClause, values } = buildSetClause(input, ['status', 'assigned_to', 'notes', 'follow_up_at'])
  values.push(id)

  const rows = await sql(`UPDATE contacts SET ${setClause} WHERE id = $${values.length} RETURNING *`, values)
  return rows[0] || null
}

async function getDeals(input = {}) {
  const { stage } = input
  const limit = normalizeLimit(input.limit)
  const values = []
  const whereSql = stage ? 'WHERE deals.stage = $1' : ''

  if (stage) {
    values.push(stage)
  }

  values.push(limit)

  return sql(
    `SELECT deals.*, schools.name as school_name
     FROM deals
     LEFT JOIN schools ON deals.school_id = schools.id
     ${whereSql}
     ORDER BY deals.created_at DESC
     LIMIT $${values.length}`,
    values,
  )
}

async function getStats() {
  const [contactsByStatusRows, dealsByStageRows, activityCountRows] = await Promise.all([
    sql`
      SELECT statuses.status, count(contacts.id)::int as count
      FROM (VALUES ('New'), ('Emailed'), ('Called'), ('Responded'), ('Closed')) as statuses(status)
      LEFT JOIN contacts ON contacts.status = statuses.status
      GROUP BY statuses.status
    `,
    sql`
      SELECT stage, count(*)::int as count
      FROM deals
      GROUP BY stage
      ORDER BY stage
    `,
    sql`
      SELECT count(*)::int as count
      FROM activities
      WHERE created_at >= CURRENT_DATE
        AND created_at < CURRENT_DATE + INTERVAL '1 day'
    `,
  ])

  return {
    contacts_by_status: contactsByStatusRows.reduce((summary, row) => ({ ...summary, [row.status]: Number(row.count) || 0 }), {}),
    deals_by_stage: dealsByStageRows.reduce((summary, row) => ({ ...summary, [row.stage || 'Unassigned']: Number(row.count) || 0 }), {}),
    activity_count_today: Number(activityCountRows[0]?.count) || 0,
  }
}

async function bulkUpdateContacts(input = {}) {
  const { ids, status, assigned_to } = input

  if (!Array.isArray(ids) || ids.length === 0) {
    throw new Error('ids must be a non-empty array')
  }

  requireEnum(status, CONTACT_STATUSES, 'status')
  requireEnum(assigned_to, ASSIGNEES, 'assigned_to')

  const { setClause, values } = buildSetClause(input, ['status', 'assigned_to', 'follow_up_at'])
  values.push(ids)

  return sql(
    `UPDATE contacts
     SET ${setClause}
     WHERE id = ANY($${values.length}::uuid[])
     RETURNING id, name, status`,
    values,
  )
}

async function runTool(name, input) {
  if (name === 'get_contacts') return getContacts(input)
  if (name === 'update_contact') return updateContact(input)
  if (name === 'get_deals') return getDeals(input)
  if (name === 'get_stats') return getStats(input)
  if (name === 'bulk_update_contacts') return bulkUpdateContacts(input)
  throw new Error(`Unknown tool: ${name}`)
}

function getTextContent(content) {
  return content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim()
}

function sanitizeMessages(messages) {
  if (!Array.isArray(messages)) {
    throw new Error('messages must be an array')
  }

  const validMessages = messages
    .filter((message) => ['user', 'assistant'].includes(message.role) && typeof message.content === 'string')
    .slice(-20)
    .map((message) => ({ role: message.role, content: message.content }))

  const firstUserIndex = validMessages.findIndex((message) => message.role === 'user')
  return firstUserIndex === -1 ? [] : validMessages.slice(firstUserIndex)
}

export default async function handler(req, res) {
  const userId = await getUserId(req)

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { messages: requestMessages = [] } = await readBody(req)
    const messages = sanitizeMessages(requestMessages)

    if (messages.length === 0) {
      return res.status(400).json({ error: 'messages is required' })
    }

    let response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      tools,
      messages,
    })

    for (let round = 0; round < MAX_TOOL_ROUNDS && response.stop_reason === 'tool_use'; round += 1) {
      const toolUses = response.content.filter((block) => block.type === 'tool_use')
      const toolResults = await Promise.all(
        toolUses.map(async (toolUse) => {
          try {
            const result = await runTool(toolUse.name, toolUse.input || {})
            return {
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: JSON.stringify(result),
            }
          } catch (error) {
            return {
              type: 'tool_result',
              tool_use_id: toolUse.id,
              is_error: true,
              content: error.message || 'Tool failed',
            }
          }
        }),
      )

      messages.push({ role: 'assistant', content: response.content })
      messages.push({ role: 'user', content: toolResults })

      response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system: systemPrompt,
        tools,
        messages,
      })
    }

    return res.status(200).json({ response: getTextContent(response.content) || 'Done.' })
  } catch (error) {
    console.error('AI assistant error:', error)
    return res.status(500).json({ error: error.message || 'AI assistant failed' })
  }
}
