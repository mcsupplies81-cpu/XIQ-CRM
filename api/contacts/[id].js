import { getUserId } from '../_auth.js'
import { sql } from '../db.js'

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

  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { id } = req.query
  const { status, assigned_to, notes } = await readBody(req)
  const hasStatus = status !== undefined
  const hasAssignedTo = assigned_to !== undefined
  const hasNotes = notes !== undefined

  if (!hasStatus && !hasAssignedTo && !hasNotes) {
    return res.status(400).json({ error: 'No fields provided' })
  }

  const updatedRows = await sql`
    UPDATE contacts
    SET
      status = CASE WHEN ${hasStatus} THEN ${hasStatus ? status : null} ELSE status END,
      assigned_to = CASE WHEN ${hasAssignedTo} THEN ${hasAssignedTo ? assigned_to : null} ELSE assigned_to END,
      notes = CASE WHEN ${hasNotes} THEN ${hasNotes ? notes : null} ELSE notes END
    WHERE id = ${id}
    RETURNING *
  `

  if (updatedRows.length === 0) {
    return res.status(404).json({ error: 'Contact not found' })
  }

  return res.status(200).json(updatedRows[0])
}
