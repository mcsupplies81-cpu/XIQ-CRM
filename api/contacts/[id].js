import { getUserId } from '../_auth.js'
import { sql } from '../_db.js'

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

  const { id } = req.query

  if (req.method === 'DELETE') {
    const deletedRows = await sql`
      DELETE FROM contacts WHERE id = ${id} RETURNING id
    `

    if (deletedRows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' })
    }

    return res.status(200).json({ id: deletedRows[0].id })
  }

  if (req.method === 'PATCH') {
    const body = await readBody(req)
    const has = (f) => Object.prototype.hasOwnProperty.call(body, f)
    const hasStatus = has('status')
    const hasAssignedTo = has('assigned_to')
    const hasNotes = has('notes')
    const hasFollowUpAt = has('follow_up_at')
    const hasName = has('name')
    const hasEmail = has('email')
    const hasPhone = has('phone')
    const hasRole = has('role')
    const hasXHandle = has('x_handle')
    const hasLinkedinUrl = has('linkedin_url')

    if (!hasStatus && !hasAssignedTo && !hasNotes && !hasFollowUpAt && !hasName && !hasEmail && !hasPhone && !hasRole && !hasXHandle && !hasLinkedinUrl) {
      return res.status(400).json({ error: 'No fields provided' })
    }

    const updatedRows = await sql`
      UPDATE contacts
      SET
        status       = CASE WHEN ${hasStatus}      THEN ${hasStatus      ? body.status      : null} ELSE status       END,
        assigned_to  = CASE WHEN ${hasAssignedTo}  THEN ${hasAssignedTo  ? body.assigned_to : null} ELSE assigned_to  END,
        notes        = CASE WHEN ${hasNotes}        THEN ${hasNotes       ? body.notes       : null} ELSE notes        END,
        follow_up_at = CASE WHEN ${hasFollowUpAt}  THEN ${hasFollowUpAt  ? body.follow_up_at|| null : null} ELSE follow_up_at END,
        name         = CASE WHEN ${hasName}         THEN ${hasName        ? body.name        : null} ELSE name         END,
        email        = CASE WHEN ${hasEmail}        THEN ${hasEmail       ? body.email || null : null} ELSE email        END,
        phone        = CASE WHEN ${hasPhone}        THEN ${hasPhone       ? body.phone || null : null} ELSE phone        END,
        role         = CASE WHEN ${hasRole}         THEN ${hasRole        ? body.role  || null : null} ELSE role         END,
        x_handle     = CASE WHEN ${hasXHandle}      THEN ${hasXHandle     ? body.x_handle || null : null} ELSE x_handle     END,
        linkedin_url = CASE WHEN ${hasLinkedinUrl}  THEN ${hasLinkedinUrl ? body.linkedin_url || null : null} ELSE linkedin_url END
      WHERE id = ${id}
      RETURNING *
    `

    if (updatedRows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' })
    }

    return res.status(200).json(updatedRows[0])
  }

  res.setHeader('Allow', 'PATCH, DELETE')
  return res.status(405).json({ error: 'Method not allowed' })
}
