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

  if (req.method === 'GET') {
    const schools = await sql`
      SELECT * FROM schools
      WHERE id = ${id}
    `

    if (schools.length === 0) {
      return res.status(404).json({ error: 'School not found' })
    }

    const contacts = await sql`
      SELECT * FROM contacts
      WHERE school_id = ${id}
      ORDER BY created_at DESC
    `

    const deals = await sql`
      SELECT deals.*, contacts.name as contact_name
      FROM deals
      LEFT JOIN contacts ON deals.contact_id = contacts.id
      WHERE deals.school_id = ${id}
      ORDER BY deals.created_at DESC
    `

    return res.status(200).json({ school: schools[0], contacts, deals })
  }

  if (req.method === 'PATCH') {
    const { notes = '' } = await readBody(req)
    const updatedRows = await sql`
      UPDATE schools
      SET notes = ${notes || ''}
      WHERE id = ${id}
      RETURNING *
    `

    if (updatedRows.length === 0) {
      return res.status(404).json({ error: 'School not found' })
    }

    return res.status(200).json(updatedRows[0])
  }

  res.setHeader('Allow', 'GET, PATCH')
  return res.status(405).json({ error: 'Method not allowed' })
}
