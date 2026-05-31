import { getUserId } from './_auth.js'
import { sql } from './db.js'

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

  if (req.method === 'GET') {
    const { contact_id } = req.query

    const deals = contact_id
      ? await sql`
          SELECT deals.*, schools.name as school_name, contacts.name as contact_name
          FROM deals
          LEFT JOIN schools ON deals.school_id = schools.id
          LEFT JOIN contacts ON deals.contact_id = contacts.id
          WHERE deals.contact_id = ${contact_id}
          ORDER BY deals.created_at DESC
        `
      : await sql`
          SELECT deals.*, schools.name as school_name, contacts.name as contact_name
          FROM deals
          LEFT JOIN schools ON deals.school_id = schools.id
          LEFT JOIN contacts ON deals.contact_id = contacts.id
          ORDER BY deals.created_at DESC
        `

    return res.status(200).json(deals)
  }

  if (req.method === 'POST') {
    const { school_id = null, contact_id = null, title, value = null, stage = 'Prospecting', close_date = null, notes = '' } = await readBody(req)

    if (!title) {
      return res.status(400).json({ error: 'title is required' })
    }

    const insertedRows = await sql`
      INSERT INTO deals (school_id, contact_id, title, value, stage, close_date, notes)
      VALUES (${school_id || null}, ${contact_id || null}, ${title}, ${value === '' ? null : value}, ${stage || 'Prospecting'}, ${close_date || null}, ${notes || ''})
      RETURNING *
    `

    return res.status(201).json(insertedRows[0])
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).json({ error: 'Method not allowed' })
}
