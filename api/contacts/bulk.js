import { getUserId } from '../_auth.js'
import { sql } from '../db.js'

const validStatuses = ['New', 'Emailed', 'Called', 'Responded', 'Closed']

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

  const { ids, status } = await readBody(req)

  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
    return res.status(400).json({ error: 'ids must be an array of strings' })
  }

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' })
  }

  if (ids.length === 0) {
    return res.status(200).json({ updated: 0 })
  }

  const updatedRows = await sql`
    UPDATE contacts
    SET status = ${status}, updated_at = now()
    WHERE id = ANY(${ids}::uuid[])
    RETURNING id, status
  `

  return res.status(200).json({ updated: updatedRows.length })
}
