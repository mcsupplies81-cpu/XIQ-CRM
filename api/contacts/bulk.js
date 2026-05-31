import { getUserId } from '../_auth.js'
import { sql } from '../db.js'

const validStatuses = ['New', 'Emailed', 'Called', 'Responded', 'Closed']
const validAssignees = ['Email', 'Calls', 'DMs']

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

export default async function handler(req, res) {
  const userId = await getUserId(req)

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { ids, status, assigned_to } = await readBody(req)

  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
    return res.status(400).json({ error: 'ids must be an array of strings' })
  }

  if (ids.length === 0) {
    return res.status(200).json({ updated: 0 })
  }

  const hasStatus = status !== undefined
  const hasAssignedTo = assigned_to !== undefined

  if (hasStatus && !validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' })
  }

  if (hasAssignedTo && !validAssignees.includes(assigned_to)) {
    return res.status(400).json({ error: 'Invalid assigned_to' })
  }

  if (!hasStatus && !hasAssignedTo) {
    return res.status(400).json({ error: 'status or assigned_to is required' })
  }

  const updatedRows = await sql`
    UPDATE contacts
    SET
      status      = CASE WHEN ${hasStatus}     THEN ${hasStatus     ? status      : null} ELSE status      END,
      assigned_to = CASE WHEN ${hasAssignedTo} THEN ${hasAssignedTo ? assigned_to : null} ELSE assigned_to END,
      updated_at  = now()
    WHERE id = ANY(${ids}::uuid[])
    RETURNING id
  `

  return res.status(200).json({ updated: updatedRows.length })
}
