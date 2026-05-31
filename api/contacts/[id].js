import { getAuth } from '@clerk/backend'
import { sql } from '../db.js'

function parseBody(body) {
  if (!body) {
    return {}
  }

  return typeof body === 'string' ? JSON.parse(body) : body
}

export default async function handler(req, res) {
  const { userId } = getAuth(req)

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { id } = req.query
    const body = parseBody(req.body)
    const fields = {
      status: body.status,
      assigned_to: body.assigned_to,
      notes: body.notes,
    }
    const allowedFields = Object.entries(fields).filter(([, value]) => value !== undefined)

    if (allowedFields.length === 0) {
      return res.status(400).json({ error: 'No allowed fields provided' })
    }

    const [contact] = await sql`
      UPDATE contacts
      SET
        status = CASE WHEN ${fields.status !== undefined} THEN ${fields.status} ELSE status END,
        assigned_to = CASE WHEN ${fields.assigned_to !== undefined} THEN ${fields.assigned_to} ELSE assigned_to END,
        notes = CASE WHEN ${fields.notes !== undefined} THEN ${fields.notes} ELSE notes END
      WHERE id = ${id}
      RETURNING *
    `

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' })
    }

    return res.status(200).json(contact)
  } catch (error) {
    console.error('PATCH /api/contacts/[id] failed', error)
    return res.status(500).json({ error: 'Failed to update contact' })
  }
}
